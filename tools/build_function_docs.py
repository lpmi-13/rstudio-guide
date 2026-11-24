#!/usr/bin/env python3
"""Refresh the coach's function links from official R and CRAN manual indexes.

Only functions named in lesson prose or step titles are included. Run this when
lessons add functions; the coach uses the committed map without a network call.
"""
import html
import json
import re
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PACKAGES = """dplyr tidyr ggplot2 readr stringr forcats lubridate purrr tibble dbplyr
readxl rvest jsonlite arrow janitor gt reactable writexl patchwork reprex quarto
duckdb DBI scales hms vctrs tidyselect fs ggrepel rlang base stats utils graphics grDevices methods""".split()
FUNCTION = re.compile(r"\b([A-Za-z][\w.]*)\(\)")
INDEX_LINK = re.compile(r'<a href="([^"#]+\.html)">([^<]+)</a>')


def names_in_lessons():
    names = set()
    for path in (ROOT / "scenarios").glob("*/scenario.json"):
        lesson = json.loads(path.read_text())
        if "steps" not in lesson:
            continue
        names.update(FUNCTION.findall(lesson.get("summary", "")))
        for step in lesson["steps"]:
            names.update(FUNCTION.findall(step.get("title", "")))
            for text in (step.get("explain", ""), *(r.get(key, "") for r in step["runs"] for key in ("task", "purpose"))):
                names.update(FUNCTION.findall(text))
    return names


def package_index(package):
    collection = "R" if package in {"base", "stats", "utils", "graphics", "grDevices", "methods"} else "CRAN"
    base = f"https://search.r-project.org/{collection}/refmans/{package}/html/"
    request = urllib.request.Request(base + "00Index.html", headers={"User-Agent": "rstudio-guide-doc-map/1.0"})
    with urllib.request.urlopen(request, timeout=20) as response:
        index = response.read().decode("utf-8")
    return package, {html.unescape(alias): base + href for href, alias in INDEX_LINK.findall(index)}


def main():
    names = names_in_lessons()
    with ThreadPoolExecutor(max_workers=8) as pool:
        found = dict(pool.map(package_index, PACKAGES))
    docs = {}
    for name in sorted(names):
        for package in PACKAGES:
            if name in found[package]:
                docs[name] = found[package][name]
                break
    missing = sorted(names - docs.keys())
    output = ROOT / "coach" / "coach.js"
    source = output.read_text()
    start, end = "/* function docs:start */", "/* function docs:end */"
    assert source.count(start) == source.count(end) == 1
    before, rest = source.split(start, 1)
    _, after = rest.split(end, 1)
    output.write_text(before + start + " " + json.dumps(docs, ensure_ascii=False, indent=2) + " " + end + after)
    print(f"Linked {len(docs)} functions in {output.relative_to(ROOT)}")
    print(f"No package manual entry for {len(missing)} names: {', '.join(missing)}")


if __name__ == "__main__":
    main()
