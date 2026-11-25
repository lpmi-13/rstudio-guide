#!/usr/bin/env python3
"""A slow, stalling link for tests/slow_link.sh: a TCP proxy that caps bytes per second in each
direction (shared by all connections, as one learner's line is) and stalls on demand.

  python3 -I tests/slow_link_proxy.py LISTEN_PORT TARGET_PORT DOWN_BYTES_PER_S UP_BYTES_PER_S STALL_FILE

While STALL_FILE exists, nothing flows either way and new connections wait, without being closed:
a dead spot on a mobile connection, rather than a connection that fails at once. Chromium's own
throttling (CDP) adds latency in the audit; its bandwidth cap and offline switch didn't take effect
in Playwright's headless Chromium (25 November 2026), hence this proxy.
"""
import asyncio
import sys
import time
from pathlib import Path

LISTEN, TARGET, DOWN, UP = (int(a) for a in sys.argv[1:5])
STALL = Path(sys.argv[5])


class Bucket:
    """At most `rate` bytes per second, across every connection that shares it."""

    def __init__(self, rate):
        self.rate, self.tokens, self.at = rate, 0.0, time.monotonic()
        self.lock = asyncio.Lock()

    async def take(self, n):
        async with self.lock:
            while True:
                now = time.monotonic()
                self.tokens = min(self.rate, self.tokens + (now - self.at) * self.rate)
                self.at = now
                if self.tokens >= n:
                    self.tokens -= n
                    return
                await asyncio.sleep((n - self.tokens) / self.rate)


async def flowing():
    while STALL.exists():
        await asyncio.sleep(0.2)


async def pipe(reader, writer, bucket):
    try:
        while data := await reader.read(1024):
            await flowing()
            await bucket.take(len(data))
            writer.write(data)
            await writer.drain()
    except (ConnectionError, asyncio.CancelledError):
        pass
    finally:
        writer.close()


async def main():
    down, up = Bucket(DOWN), Bucket(UP)

    async def handle(client_r, client_w):
        await flowing()
        try:
            server_r, server_w = await asyncio.open_connection("127.0.0.1", TARGET)
        except OSError:
            client_w.close()
            return
        await asyncio.gather(pipe(client_r, server_w, up), pipe(server_r, client_w, down))

    server = await asyncio.start_server(handle, "127.0.0.1", LISTEN)
    print(f"slow link: 127.0.0.1:{LISTEN} -> {TARGET}, {DOWN} B/s down, {UP} B/s up", flush=True)
    async with server:
        await server.serve_forever()


asyncio.run(main())
