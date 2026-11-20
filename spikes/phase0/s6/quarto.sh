#!/bin/sh
# S6: Quarto's formats render with no network: HTML (gt, reactable, ggplot2), Word, PDF through
# Typst, revealjs, a dashboard and a two-page website.
set -u
cd /work
quarto --version
t() { name=$1; shift; s=$(date +%s%N); if "$@" >/tmp/q.log 2>&1; then r=ok; else r=FAILED; fi; e=$(date +%s%N); printf '%-22s %-6s %5d ms\n' "$name" "$r" "$(( (e - s) / 1000000 ))"; [ "$r" = ok ] || tail -5 /tmp/q.log; }
t html        quarto render report.qmd --to html
t docx-widget quarto render report.qmd --to docx
t docx        quarto render slides.qmd --to docx --output slides.docx
t typst-pdf   quarto render slides.qmd --to typst --output slides-typst.pdf
t revealjs    quarto render slides.qmd
t dashboard   quarto render dashboard.qmd
t website     quarto render site
t r-quarto-pkg Rscript -e 'quarto::quarto_render("site/about.qmd", quiet = TRUE)'
ls -la *.html *.docx *.pdf site/_site 2>/dev/null | awk '{print $5, $9}'
