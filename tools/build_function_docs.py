#!/usr/bin/env python3
"""Refresh the coach's documentation links from official R and CRAN manual indexes.

Functions: every name the lessons' prose, tasks, purposes or step titles write as a call, with
or without arguments (`ggplot()`, `scale_colour_viridis_d(end = 0.8)`), links to its manual page.
The coach links the same names the same way (`linkNames` in coach/coach.js).

Packages: every package in PACKAGES links to its home page, the first URL in its CRAN DESCRIPTION
(ggplot2 -> https://ggplot2.tidyverse.org), or its manual's index for base R's packages.

Names that aren't a package's function (the lessons' own functions, SQL, words such as "Line(s)")
are listed in UNLINKED or found as `name <- function(` in a lesson's code. check_content.py fails
when a lesson names any other function that has no link. Run this when lessons add functions; the
coach uses the committed maps without a network call.
"""
import html
import json
import re
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PACKAGES = """dplyr tidyr ggplot2 readr stringr forcats lubridate purrr tibble dbplyr duckplyr
readxl rvest jsonlite arrow janitor gt reactable writexl patchwork reprex quarto broom
duckdb DBI scales hms vctrs tidyselect fs ggrepel rlang base stats utils graphics grDevices methods""".split()
BASE_PACKAGES = {"base", "stats", "utils", "graphics", "grDevices", "methods"}
# Package names the coach links in prose and code. tidyverse isn't in PACKAGES (it has no
# functions the lessons name) but is linked as a package.
LINKED_PACKAGES = sorted(set(PACKAGES) - BASE_PACKAGES | {"tidyverse"})
CALL = re.compile(r"\b([A-Za-z][\w.]*)\(")
DEFINED = re.compile(r"\b([A-Za-z][\w.]*)\s*(?:<-|=)\s*function\(")
# Written like calls in lesson text, but not R functions with a manual page.
UNLINKED = {
    "function",  # R's keyword, in `function(x)`
    "COUNT",     # SQL, in lesson 21's query
    "Line",      # "Run Selected Line(s)", RStudio's menu item
}
# Functions whose page the manual indexes lack: newer than search.r-project.org's copy of the
# package (duckplyr), a generic documented by its methods (augment), or left out of the index.
# Each points at the package's own reference site.
OVERRIDES = {
    "augment": "https://broom.tidymodels.org/reference/augment.lm.html",
    "comma": "https://scales.r-lib.org/reference/comma.html",
    "compute_parquet": "https://duckplyr.tidyverse.org/reference/compute_parquet.html",
    "read_parquet_duckdb": "https://duckplyr.tidyverse.org/reference/read_parquet_duckdb.html",
}
INDEX_LINK = re.compile(r'<a href="([^"#]+\.html)">([^<]+)</a>')
URL_FIELD = re.compile(r"<td>URL:</td>\s*<td>(.*?)</td>", re.S)
HREF = re.compile(r'href="(https?://[^"]+)"')


def lesson_texts(lesson):
    yield lesson.get("summary", "")
    for step in lesson["steps"]:
        yield step.get("title", "")
        yield step.get("explain", "")
        for run in step["runs"]:
            yield run.get("task", "")
            yield run.get("purpose", "")


def lessons():
    for path in sorted((ROOT / "scenarios").glob("*/scenario.json")):
        lesson = json.loads(path.read_text())
        if "steps" in lesson:
            yield lesson


def defined_names(lesson):
    """Functions a lesson defines in its own code: `km_to_miles <- function(`."""
    names = set()
    for step in lesson["steps"]:
        for run in step["runs"]:
            names.update(DEFINED.findall(run.get("code", "")))
            names.update(DEFINED.findall(run.get("text", "")))
    return names


def called_names(lesson):
    names = set()
    for text in lesson_texts(lesson):
        names.update(CALL.findall(text))
    return names


def names_to_link():
    names, own = set(), set()
    for lesson in lessons():
        names |= called_names(lesson)
        own |= defined_names(lesson)
    return names - own - UNLINKED


def fetch(url):
    with urllib.request.urlopen(url, timeout=20) as response:
        return response.read().decode("utf-8")


def package_index(package):
    collection = "R" if package in BASE_PACKAGES else "CRAN"
    base = f"https://search.r-project.org/{collection}/refmans/{package}/html/"
    return package, {html.unescape(alias): base + href for href, alias in INDEX_LINK.findall(fetch(base + "00Index.html"))}


def package_home(package):
    """The package's documentation site from its DESCRIPTION's URLs, as CRAN shows them: the first one
    that isn't a code repository, else the first; its manual if there's none."""
    page = fetch(f"https://cran.r-project.org/web/packages/{package}/index.html")
    field = URL_FIELD.search(page)
    urls = HREF.findall(field.group(1)) if field else []
    urls = [url for url in urls if "github.com" not in url] + [url for url in urls if "github.com" in url]
    return package, urls[0] if urls else f"https://search.r-project.org/CRAN/refmans/{package}/html/00Index.html"


def replace_block(source, name, value):
    start, end = f"/* {name}:start */", f"/* {name}:end */"
    assert source.count(start) == source.count(end) == 1, name
    before, rest = source.split(start, 1)
    _, after = rest.split(end, 1)
    return before + start + " " + json.dumps(value, ensure_ascii=False, indent=2) + " " + end + after


def main():
    names = names_to_link()
    with ThreadPoolExecutor(max_workers=8) as pool:
        found = dict(pool.map(package_index, PACKAGES))
        homes = dict(pool.map(package_home, LINKED_PACKAGES))
    docs = {name: url for name, url in OVERRIDES.items() if name in names}
    for name in sorted(names - docs.keys()):
        for package in PACKAGES:
            if name in found[package]:
                docs[name] = found[package][name]
                break
    missing = sorted(names - docs.keys())
    output = ROOT / "coach" / "coach.js"
    source = replace_block(output.read_text(), "function docs", docs)
    source = replace_block(source, "package docs", dict(sorted(homes.items())))
    output.write_text(source)
    print(f"Linked {len(docs)} functions and {len(homes)} packages in {output.relative_to(ROOT)}")
    print(f"No package manual entry for {len(missing)} names: {', '.join(missing) or 'none'}")
    return 1 if missing else 0


if __name__ == "__main__":
    raise SystemExit(main())
