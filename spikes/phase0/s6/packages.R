# S6: every package the lessons plan to use loads with no network, and how long each takes.
pkgs <- c("tidyverse", "readxl", "writexl", "janitor", "DBI", "dbplyr", "duckdb", "duckplyr", "jsonlite",
          "rvest", "xml2", "lubridate", "broom", "patchwork", "ggrepel", "scales", "gt", "reactable",
          "htmlwidgets", "styler", "quarto", "later", "reprex", "knitr", "rmarkdown", "shiny", "rlang")
for (p in pkgs) {
  t <- system.time(ok <- suppressPackageStartupMessages(requireNamespace(p, quietly = TRUE)))[["elapsed"]]
  cat(sprintf("%-12s %-5s %-9s %.2fs\n", p, ok, if (ok) as.character(packageVersion(p)) else "-", t))
}
cat("R", as.character(getRversion()), "| packages installed:", nrow(installed.packages()), "\n")
