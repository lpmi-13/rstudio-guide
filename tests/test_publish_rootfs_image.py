"""Exercise rootfs publishing without building, pushing or changing a playground.

Modelled on argo-remotelab's tests/test_publish_rootfs_image.py: docker and labctl
are stubs that record their calls.

  python3 tests/test_publish_rootfs_image.py -v
"""

import os
import re
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO = "ghcr.io/lpmi-13/rstudio-guide-rootfs"
# The custom playground's name, as iximiuz assigned it (e.g. rstudio-guide-16afe14e).
PLAYGROUND = re.search(r"^name:\s*(\S+)", (ROOT / "iximiuz/manifest.yaml").read_text(), re.M).group(1)


class PublishRootfsImageTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory(prefix="rstudio-publish-test-")
        self.addCleanup(temporary.cleanup)
        self.fixture = Path(temporary.name)
        self.root = self.fixture / "rstudio-guide"
        self.bin_dir = self.fixture / "bin"
        self.bin_dir.mkdir()
        # A git checkout of the tracked files as they are now: the rootfs is built from tracked files only.
        tracked = subprocess.run(["git", "-C", str(ROOT), "ls-files", "-z"], check=True, capture_output=True, text=True).stdout
        for rel in filter(None, tracked.split("\0")):
            if not (ROOT / rel).exists():
                continue  # deleted in the working tree, not yet committed
            (self.root / rel).parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(ROOT / rel, self.root / rel)
        git = ["git", "-C", str(self.root), "-c", "user.name=test", "-c", "user.email=test@localhost", "-c", "commit.gpgsign=false"]
        for args in (["init", "-q"], ["add", "-A"], ["commit", "-q", "--no-verify", "-m", "fixture"]):
            subprocess.run([*git, *args], check=True, capture_output=True)
        # Per-run state that must never reach the rootfs.
        (self.root / "run").mkdir()
        (self.root / "run/.env").write_text("RSTUDIO_PASSWORD=secret\n")
        self._set_current_tag("v0")

        self._write_executable("docker", """#!/usr/bin/env bash
set -euo pipefail
printf 'docker %s\\n' "$*" >> "$CALL_LOG"
case "$1" in
  save) install -m 0600 /dev/null "$3" ;;
  build)
    context="${@: -1}"
    if [[ -f "$context/images.tar" ]]; then
      (cd "$context" && find . -maxdepth 2 | sort > "$CONTEXT_LOG" && cat rstudio-guide/lab.env >> "$CONTEXT_LOG" \
        && echo "images.tar mode $(stat -c %a images.tar)" >> "$CONTEXT_LOG" \
        && grep -h '^readonly ROOTFS_IMAGE_TAG=' rstudio-guide/iximiuz/versions.sh >> "$CONTEXT_LOG" \
        && if test -x rstudio-guide/iximiuz/start-lab.sh; then echo "start-lab.sh executable" >> "$CONTEXT_LOG"; fi)
    fi ;;
  push) if [[ "$2" == *-rootfs:* && "${FAIL_ROOTFS_PUSH:-0}" == 1 ]]; then exit 53; fi ;;
esac
""")
        self._write_executable("labctl", """#!/usr/bin/env bash
set -euo pipefail
printf 'labctl %s\\n' "$*" >> "$CALL_LOG"
case "$1 $2" in
  'auth whoami') test -f "$AUTH_MARKER" ;;
  'auth login') : > "$AUTH_MARKER" ;;
  'playground manifest') test "${PLAYGROUND_EXISTS:-0}" = 1 ;;
  'playground update')
    test "$4" = --file
    grep -Fq "source: oci://ghcr.io/lpmi-13/rstudio-guide-rootfs:${TEST_TAG}" "$5"
    test "${FAIL_REMOTE_UPDATE:-0}" != 1
    ;;
  *) exit 2 ;;
esac
""")
        self.log = self.fixture / "calls.log"
        self.context_log = self.fixture / "context.log"
        self.auth_marker = self.fixture / "authenticated"
        self.env = os.environ.copy()
        self.env.update(
            PATH=f"{self.bin_dir}:/usr/bin:/bin",
            CALL_LOG=str(self.log),
            CONTEXT_LOG=str(self.context_log),
            AUTH_MARKER=str(self.auth_marker),
            PUSH_RETRY_DELAY="0",
        )

    def _write_executable(self, name, contents):
        path = self.bin_dir / name
        path.write_text(contents)
        path.chmod(0o755)

    def _set_current_tag(self, tag):
        versions = self.root / "iximiuz/versions.sh"
        text = re.sub(r'^(readonly ROOTFS_IMAGE_TAG=")[^"]+(")', rf"\g<1>{tag}\g<2>", versions.read_text(), flags=re.M)
        text = re.sub(r'^(readonly ROOTFS_IMAGE="[^:"]+:)[^"]+(")', rf"\g<1>{tag}\g<2>", text, flags=re.M)
        versions.write_text(text)
        manifest = self.root / "iximiuz/manifest.yaml"
        manifest.write_text(re.sub(rf"(source: oci://{re.escape(REPO)}:)\S+", rf"\g<1>{tag}", manifest.read_text()))

    def _run(self, *arguments, test_tag, **environment):
        return subprocess.run(
            ["bash", str(self.root / "iximiuz/publish-rootfs-image.sh"), *arguments],
            cwd=self.root,
            env={**self.env, "TEST_TAG": test_tag, **environment},
            text=True,
            capture_output=True,
            check=False,
        )

    def _calls(self):
        return self.log.read_text().splitlines() if self.log.exists() else []

    def _refs(self):
        return (self.root / "iximiuz/versions.sh").read_text() + (self.root / "iximiuz/manifest.yaml").read_text()

    def test_without_tag_publishes_the_next_version_everywhere(self):
        self.auth_marker.touch()
        result = self._run(test_tag="v1")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn(f"docker push {REPO}:v1", self._calls())
        refs = self._refs()
        self.assertIn('readonly ROOTFS_IMAGE_TAG="v1"', refs)
        self.assertIn(f'readonly ROOTFS_IMAGE="{REPO}:v1"', refs)
        self.assertIn(f"source: oci://{REPO}:v1", refs)
        # No custom playground yet: publishing still succeeds and says how to create one.
        self.assertFalse(any(c.startswith("labctl playground update") for c in self._calls()))
        self.assertIn("labctl playground create --base docker -f iximiuz/manifest.yaml", result.stdout)

        self.log.write_text("")
        again = self._run(test_tag="v2")
        self.assertEqual(again.returncode, 0, again.stderr)
        self.assertIn(f"docker push {REPO}:v2", self._calls())
        self.assertIn(f"source: oci://{REPO}:v2", self._refs())

    def test_login_precedes_build_and_remote_update_uses_new_manifest(self):
        result = self._run("v7", test_tag="v7", PLAYGROUND_EXISTS="1")
        self.assertEqual(result.returncode, 0, result.stderr)
        calls = self._calls()
        self.assertEqual(calls[:3], ["labctl auth whoami", "labctl auth login", "labctl auth whoami"])
        self.assertTrue(calls[3].startswith("docker build "))
        self.assertTrue(calls[-1].startswith(f"labctl playground update {PLAYGROUND} --file "))

    def test_rootfs_gets_iximiuz_settings_but_no_run_state_or_audits(self):
        self.auth_marker.touch()
        (self.root / "notes.env").write_text("SECRET=stray\n")  # untracked: must never reach the public image
        result = self._run(test_tag="v1")
        self.assertEqual(result.returncode, 0, result.stderr)
        context = self.context_log.read_text()
        for expected in ("./Dockerfile", "./images.tar", "./rstudio-guide/iximiuz", "./rstudio-guide/runtime", "images.tar mode 644",
                         "FRAME_ORIGIN=https://labs.iximiuz.com", "GATEWAY_BIND=0.0.0.0", "LAB_PREBUILT=1",
                         # setUp's uncommitted edit to a tracked file is published, as before.
                         'readonly ROOTFS_IMAGE_TAG="v0"', "start-lab.sh executable"):
            self.assertIn(expected, context)
        for unexpected in ("./rstudio-guide/run", "./rstudio-guide/tests", "./rstudio-guide/results", "./rstudio-guide/.git",
                           "./rstudio-guide/notes.env"):
            self.assertNotIn(unexpected, context.splitlines())
        self.assertIn("  notes.env", result.stderr)  # named, in case it was meant to be published

    def test_refuses_to_build_outside_a_git_checkout(self):
        shutil.rmtree(self.root / ".git")
        result = self._run("v1", test_tag="v1")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("not the top of a git checkout", result.stderr)
        self.assertFalse(any(c.startswith("docker push") for c in self._calls()))

    def test_failed_rootfs_push_does_not_change_refs_or_update_playground(self):
        self.auth_marker.touch()
        result = self._run(test_tag="v1", FAIL_ROOTFS_PUSH="1", PLAYGROUND_EXISTS="1")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn(f"docker push {REPO}:v1", self._calls())
        self.assertFalse(any(c.startswith("labctl playground update") for c in self._calls()))
        self.assertNotIn(f"{REPO}:v1", self._refs())

    def test_missing_labctl_fails_before_build(self):
        (self.bin_dir / "labctl").unlink()
        result = self._run(test_tag="v1")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("labctl is required", result.stderr)
        self.assertEqual(self._calls(), [])

    def test_without_tag_rejects_a_tag_it_cannot_increment(self):
        self._set_current_tag("release-a")
        result = self._run(test_tag="unused")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("pass a new tag explicitly", result.stderr)
        self.assertEqual(self._calls(), [])

    def test_rejects_the_tag_already_in_use(self):
        self._set_current_tag("v4")
        result = self._run("v4", test_tag="v4")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("already referenced", result.stderr)
        self.assertEqual(self._calls(), [])

    def test_remote_failure_can_be_retried_without_rebuilding(self):
        self.auth_marker.touch()
        result = self._run(test_tag="v1", PLAYGROUND_EXISTS="1", FAIL_REMOTE_UPDATE="1")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("--sync-remote", result.stderr)
        self.assertIn(f"source: oci://{REPO}:v1", self._refs())

        self.log.write_text("")
        retry = self._run("--sync-remote", test_tag="v1", PLAYGROUND_EXISTS="1")
        self.assertEqual(retry.returncode, 0, retry.stderr)
        self.assertEqual(self._calls()[0], "labctl auth whoami")
        self.assertTrue(self._calls()[-1].startswith("labctl playground update "))
        self.assertFalse(any(c.startswith("docker ") for c in self._calls()))


if __name__ == "__main__":
    unittest.main()
