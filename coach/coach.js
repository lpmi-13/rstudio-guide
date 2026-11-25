// Coach for RStudio Server. The gateway injects this into the IDE host page,
// before RStudio's own scripts load.
//
// The coach docks into RStudio's sidebar when that pane is shown and floats
// otherwise. A scenario with steps opens on a choice of three modes over the
// same steps and reference output:
// - Demonstration works RStudio the way a learner would: a visible pointer moves
//   to each control it clicks, and code is typed into the Source pane one key at
//   a time, then run with RStudio's Run button (not saved: nothing needs the file
//   on disk). It waits until the Console or Plots pane shows the result, checks it
//   against the reference output, and only then explains it, using the values
//   RStudio displayed. Auto-advance (off unless the learner turns it on) moves on
//   to the next step once the explanation has been read.
// - Guided gives one step at a time. The learner types and runs each line; the
//   coach ticks it once RStudio shows the reference result, and offers hints and
//   Show me (a one-line demonstration).
// - Solo lists every task; results are disclosed only when the learner checks.
// Choosing a mode, or Start over, starts the lesson afresh: its script goes back to the
// step headings, and the Console, Environment and Plots are emptied, so nothing from an
// earlier mode or lesson carries over.
// regional-revenue (no steps yet) has a Guided stub with a Check work button.
//
// Guided and Solo confirm lines from what RStudio shows, in the page, because
// these lessons hide nothing: their code and reference output are public. Work
// with a private answer belongs to a grader that runs saved files in a separate
// process.
(() => {
  // Skip frames nested inside RStudio itself (Help, Viewer, ...). RStudio being framed by
  // a cross-origin learning platform (an iximiuz Labs tab) is fine: the parent is unreadable.
  const insideRStudio = (() => {
    if (window.top === window) return false;
    try { return Boolean(window.parent.document.getElementById('rstudio_container')); } catch (_error) { return false; }
  })();
  if (insideRStudio) return;
  if (window.__rsCoach) return; // idempotent if the script is loaded twice
  const FUNCTION_DOCS = /* function docs:start */ {
  "augment": "https://broom.tidymodels.org/reference/augment.lm.html",
  "comma": "https://scales.r-lib.org/reference/comma.html",
  "compute_parquet": "https://duckplyr.tidyverse.org/reference/compute_parquet.html",
  "read_parquet_duckdb": "https://duckplyr.tidyverse.org/reference/read_parquet_duckdb.html",
  "View": "https://search.r-project.org/R/refmans/utils/html/View.html",
  "across": "https://search.r-project.org/CRAN/refmans/dplyr/html/across.html",
  "aes": "https://search.r-project.org/CRAN/refmans/ggplot2/html/aes.html",
  "after_stat": "https://search.r-project.org/CRAN/refmans/ggplot2/html/aes_eval.html",
  "all": "https://search.r-project.org/R/refmans/base/html/all.html",
  "anti_join": "https://search.r-project.org/CRAN/refmans/dplyr/html/filter-joins.html",
  "any": "https://search.r-project.org/R/refmans/base/html/any.html",
  "arrange": "https://search.r-project.org/CRAN/refmans/dplyr/html/arrange.html",
  "as.numeric": "https://search.r-project.org/R/refmans/base/html/numeric.html",
  "as_date": "https://search.r-project.org/CRAN/refmans/lubridate/html/as_date.html",
  "barplot": "https://search.r-project.org/R/refmans/graphics/html/barplot.html",
  "between": "https://search.r-project.org/CRAN/refmans/dplyr/html/between.html",
  "c": "https://search.r-project.org/R/refmans/base/html/c.html",
  "case_when": "https://search.r-project.org/CRAN/refmans/dplyr/html/case_when.html",
  "cat": "https://search.r-project.org/R/refmans/base/html/cat.html",
  "ceiling": "https://search.r-project.org/R/refmans/base/html/Round.html",
  "ceiling_date": "https://search.r-project.org/CRAN/refmans/lubridate/html/round_date.html",
  "clean_names": "https://search.r-project.org/CRAN/refmans/janitor/html/clean_names.html",
  "closest": "https://search.r-project.org/CRAN/refmans/dplyr/html/join_by.html",
  "coalesce": "https://search.r-project.org/CRAN/refmans/dplyr/html/coalesce.html",
  "col_integer": "https://search.r-project.org/CRAN/refmans/readr/html/parse_atomic.html",
  "collect": "https://search.r-project.org/CRAN/refmans/dplyr/html/compute.html",
  "cols": "https://search.r-project.org/CRAN/refmans/readr/html/cols.html",
  "complete": "https://search.r-project.org/CRAN/refmans/tidyr/html/complete.html",
  "coord_cartesian": "https://search.r-project.org/CRAN/refmans/ggplot2/html/coord_cartesian.html",
  "coord_quickmap": "https://search.r-project.org/CRAN/refmans/ggplot2/html/coord_map.html",
  "count": "https://search.r-project.org/CRAN/refmans/dplyr/html/count.html",
  "cummax": "https://search.r-project.org/R/refmans/base/html/cumsum.html",
  "cummean": "https://search.r-project.org/CRAN/refmans/dplyr/html/cumall.html",
  "cummin": "https://search.r-project.org/R/refmans/base/html/cumsum.html",
  "cumsum": "https://search.r-project.org/R/refmans/base/html/cumsum.html",
  "cut": "https://search.r-project.org/R/refmans/base/html/cut.html",
  "day": "https://search.r-project.org/CRAN/refmans/lubridate/html/day.html",
  "days": "https://search.r-project.org/CRAN/refmans/lubridate/html/period.html",
  "dbConnect": "https://search.r-project.org/CRAN/refmans/DBI/html/dbConnect.html",
  "dbDisconnect": "https://search.r-project.org/CRAN/refmans/DBI/html/dbDisconnect.html",
  "dbGetQuery": "https://search.r-project.org/CRAN/refmans/DBI/html/dbGetQuery.html",
  "dbListTables": "https://search.r-project.org/CRAN/refmans/DBI/html/dbListTables.html",
  "ddays": "https://search.r-project.org/CRAN/refmans/lubridate/html/duration.html",
  "dense_rank": "https://search.r-project.org/CRAN/refmans/dplyr/html/row_number.html",
  "desc": "https://search.r-project.org/CRAN/refmans/dplyr/html/desc.html",
  "dir_create": "https://search.r-project.org/CRAN/refmans/fs/html/create.html",
  "dir_info": "https://search.r-project.org/CRAN/refmans/fs/html/dir_ls.html",
  "dir_ls": "https://search.r-project.org/CRAN/refmans/fs/html/dir_ls.html",
  "distinct": "https://search.r-project.org/CRAN/refmans/dplyr/html/distinct.html",
  "dput": "https://search.r-project.org/R/refmans/base/html/dput.html",
  "duckdb": "https://search.r-project.org/CRAN/refmans/duckdb/html/duckdb.html",
  "example": "https://search.r-project.org/R/refmans/utils/html/example.html",
  "excel_sheets": "https://search.r-project.org/CRAN/refmans/readxl/html/excel_sheets.html",
  "explain": "https://search.r-project.org/CRAN/refmans/dplyr/html/explain.html",
  "facet_grid": "https://search.r-project.org/CRAN/refmans/ggplot2/html/facet_grid.html",
  "facet_wrap": "https://search.r-project.org/CRAN/refmans/ggplot2/html/facet_wrap.html",
  "fct": "https://search.r-project.org/CRAN/refmans/forcats/html/fct.html",
  "fct_collapse": "https://search.r-project.org/CRAN/refmans/forcats/html/fct_collapse.html",
  "fct_infreq": "https://search.r-project.org/CRAN/refmans/forcats/html/fct_inorder.html",
  "fct_lump_n": "https://search.r-project.org/CRAN/refmans/forcats/html/fct_lump.html",
  "fct_recode": "https://search.r-project.org/CRAN/refmans/forcats/html/fct_recode.html",
  "fct_reorder": "https://search.r-project.org/CRAN/refmans/forcats/html/fct_reorder.html",
  "fct_rev": "https://search.r-project.org/CRAN/refmans/forcats/html/fct_rev.html",
  "file.size": "https://search.r-project.org/R/refmans/base/html/file.info.html",
  "fill": "https://search.r-project.org/CRAN/refmans/tidyr/html/fill.html",
  "filter": "https://search.r-project.org/CRAN/refmans/dplyr/html/filter.html",
  "fixed": "https://search.r-project.org/CRAN/refmans/stringr/html/modifiers.html",
  "floor": "https://search.r-project.org/R/refmans/base/html/Round.html",
  "floor_date": "https://search.r-project.org/CRAN/refmans/lubridate/html/round_date.html",
  "force_tz": "https://search.r-project.org/CRAN/refmans/lubridate/html/force_tz.html",
  "geom_bar": "https://search.r-project.org/CRAN/refmans/ggplot2/html/geom_bar.html",
  "geom_bin_2d": "https://search.r-project.org/CRAN/refmans/ggplot2/html/geom_bin_2d.html",
  "geom_boxplot": "https://search.r-project.org/CRAN/refmans/ggplot2/html/geom_boxplot.html",
  "geom_col": "https://search.r-project.org/CRAN/refmans/ggplot2/html/geom_bar.html",
  "geom_density": "https://search.r-project.org/CRAN/refmans/ggplot2/html/geom_density.html",
  "geom_freqpoly": "https://search.r-project.org/CRAN/refmans/ggplot2/html/geom_histogram.html",
  "geom_histogram": "https://search.r-project.org/CRAN/refmans/ggplot2/html/geom_histogram.html",
  "geom_label_repel": "https://search.r-project.org/CRAN/refmans/ggrepel/html/geom_text_repel.html",
  "geom_line": "https://search.r-project.org/CRAN/refmans/ggplot2/html/geom_path.html",
  "geom_point": "https://search.r-project.org/CRAN/refmans/ggplot2/html/geom_point.html",
  "geom_smooth": "https://search.r-project.org/CRAN/refmans/ggplot2/html/geom_smooth.html",
  "geom_tile": "https://search.r-project.org/CRAN/refmans/ggplot2/html/geom_tile.html",
  "getwd": "https://search.r-project.org/R/refmans/base/html/getwd.html",
  "ggplot": "https://search.r-project.org/CRAN/refmans/ggplot2/html/ggplot.html",
  "ggsave": "https://search.r-project.org/CRAN/refmans/ggplot2/html/ggsave.html",
  "glimpse": "https://search.r-project.org/CRAN/refmans/dplyr/html/glimpse.html",
  "gt": "https://search.r-project.org/CRAN/refmans/gt/html/gt.html",
  "hist": "https://search.r-project.org/R/refmans/graphics/html/hist.html",
  "hoist": "https://search.r-project.org/CRAN/refmans/tidyr/html/hoist.html",
  "hour": "https://search.r-project.org/CRAN/refmans/lubridate/html/hour.html",
  "html_attr": "https://search.r-project.org/CRAN/refmans/rvest/html/html_attr.html",
  "html_element": "https://search.r-project.org/CRAN/refmans/rvest/html/html_element.html",
  "html_elements": "https://search.r-project.org/CRAN/refmans/rvest/html/html_element.html",
  "html_table": "https://search.r-project.org/CRAN/refmans/rvest/html/html_table.html",
  "html_text2": "https://search.r-project.org/CRAN/refmans/rvest/html/html_text.html",
  "if_all": "https://search.r-project.org/CRAN/refmans/dplyr/html/across.html",
  "if_any": "https://search.r-project.org/CRAN/refmans/dplyr/html/across.html",
  "if_else": "https://search.r-project.org/CRAN/refmans/dplyr/html/if_else.html",
  "is.na": "https://search.r-project.org/R/refmans/base/html/NA.html",
  "is.nan": "https://search.r-project.org/R/refmans/base/html/is.finite.html",
  "join_by": "https://search.r-project.org/CRAN/refmans/dplyr/html/join_by.html",
  "label_comma": "https://search.r-project.org/CRAN/refmans/scales/html/label_number.html",
  "label_number": "https://search.r-project.org/CRAN/refmans/scales/html/label_number.html",
  "labs": "https://search.r-project.org/CRAN/refmans/ggplot2/html/labs.html",
  "lag": "https://search.r-project.org/CRAN/refmans/dplyr/html/lead-lag.html",
  "lapply": "https://search.r-project.org/R/refmans/base/html/lapply.html",
  "lead": "https://search.r-project.org/CRAN/refmans/dplyr/html/lead-lag.html",
  "left_join": "https://search.r-project.org/CRAN/refmans/dplyr/html/mutate-joins.html",
  "library": "https://search.r-project.org/R/refmans/base/html/library.html",
  "list": "https://search.r-project.org/R/refmans/base/html/list.html",
  "list.files": "https://search.r-project.org/R/refmans/base/html/list.files.html",
  "list_rbind": "https://search.r-project.org/CRAN/refmans/purrr/html/list_c.html",
  "lm": "https://search.r-project.org/R/refmans/stats/html/lm.html",
  "locale": "https://search.r-project.org/CRAN/refmans/readr/html/locale.html",
  "log": "https://search.r-project.org/R/refmans/base/html/Log.html",
  "logical": "https://search.r-project.org/R/refmans/base/html/logical.html",
  "make_date": "https://search.r-project.org/CRAN/refmans/lubridate/html/make_datetime.html",
  "make_datetime": "https://search.r-project.org/CRAN/refmans/lubridate/html/make_datetime.html",
  "map": "https://search.r-project.org/CRAN/refmans/purrr/html/map.html",
  "max": "https://search.r-project.org/R/refmans/base/html/Extremes.html",
  "mdy": "https://search.r-project.org/CRAN/refmans/lubridate/html/ymd.html",
  "mean": "https://search.r-project.org/R/refmans/base/html/mean.html",
  "median": "https://search.r-project.org/R/refmans/stats/html/median.html",
  "min": "https://search.r-project.org/R/refmans/base/html/Extremes.html",
  "min_rank": "https://search.r-project.org/CRAN/refmans/dplyr/html/row_number.html",
  "minute": "https://search.r-project.org/CRAN/refmans/lubridate/html/minute.html",
  "month": "https://search.r-project.org/CRAN/refmans/lubridate/html/month.html",
  "mutate": "https://search.r-project.org/CRAN/refmans/dplyr/html/mutate.html",
  "n": "https://search.r-project.org/CRAN/refmans/dplyr/html/context.html",
  "na_if": "https://search.r-project.org/CRAN/refmans/dplyr/html/na_if.html",
  "near": "https://search.r-project.org/CRAN/refmans/dplyr/html/near.html",
  "nest": "https://search.r-project.org/CRAN/refmans/tidyr/html/nest.html",
  "now": "https://search.r-project.org/CRAN/refmans/lubridate/html/now.html",
  "nrow": "https://search.r-project.org/R/refmans/base/html/nrow.html",
  "ordered": "https://search.r-project.org/R/refmans/base/html/factor.html",
  "packageVersion": "https://search.r-project.org/R/refmans/utils/html/packageDescription.html",
  "parse_integer": "https://search.r-project.org/CRAN/refmans/readr/html/parse_atomic.html",
  "parse_number": "https://search.r-project.org/CRAN/refmans/readr/html/parse_number.html",
  "paste0": "https://search.r-project.org/R/refmans/base/html/paste.html",
  "pivot_longer": "https://search.r-project.org/CRAN/refmans/tidyr/html/pivot_longer.html",
  "pivot_wider": "https://search.r-project.org/CRAN/refmans/tidyr/html/pivot_wider.html",
  "plot": "https://search.r-project.org/R/refmans/base/html/plot.html",
  "plot_layout": "https://search.r-project.org/CRAN/refmans/patchwork/html/plot_layout.html",
  "position_jitter": "https://search.r-project.org/CRAN/refmans/ggplot2/html/position_jitter.html",
  "problems": "https://search.r-project.org/CRAN/refmans/readr/html/problems.html",
  "quantile": "https://search.r-project.org/R/refmans/stats/html/quantile.html",
  "quarto_render": "https://search.r-project.org/CRAN/refmans/quarto/html/quarto_render.html",
  "reactable": "https://search.r-project.org/CRAN/refmans/reactable/html/reactable.html",
  "read_csv": "https://search.r-project.org/CRAN/refmans/readr/html/read_delim.html",
  "read_excel": "https://search.r-project.org/CRAN/refmans/readxl/html/read_excel.html",
  "read_html": "https://search.r-project.org/CRAN/refmans/rvest/html/read_html.html",
  "read_json": "https://search.r-project.org/CRAN/refmans/jsonlite/html/read_json.html",
  "read_rds": "https://search.r-project.org/CRAN/refmans/readr/html/read_rds.html",
  "regex": "https://search.r-project.org/CRAN/refmans/stringr/html/modifiers.html",
  "relocate": "https://search.r-project.org/CRAN/refmans/dplyr/html/relocate.html",
  "rename": "https://search.r-project.org/CRAN/refmans/dplyr/html/rename.html",
  "reprex": "https://search.r-project.org/CRAN/refmans/reprex/html/reprex.html",
  "round": "https://search.r-project.org/R/refmans/base/html/Round.html",
  "round_date": "https://search.r-project.org/CRAN/refmans/lubridate/html/round_date.html",
  "row_number": "https://search.r-project.org/CRAN/refmans/dplyr/html/row_number.html",
  "scale_colour_viridis_d": "https://search.r-project.org/CRAN/refmans/ggplot2/html/scale_viridis.html",
  "scale_x_log10": "https://search.r-project.org/CRAN/refmans/ggplot2/html/scale_continuous.html",
  "scale_y_log10": "https://search.r-project.org/CRAN/refmans/ggplot2/html/scale_continuous.html",
  "sd": "https://search.r-project.org/R/refmans/stats/html/sd.html",
  "select": "https://search.r-project.org/CRAN/refmans/dplyr/html/select.html",
  "semi_join": "https://search.r-project.org/CRAN/refmans/dplyr/html/filter-joins.html",
  "separate_longer_delim": "https://search.r-project.org/CRAN/refmans/tidyr/html/separate_longer_delim.html",
  "separate_wider_delim": "https://search.r-project.org/CRAN/refmans/tidyr/html/separate_wider_delim.html",
  "separate_wider_regex": "https://search.r-project.org/CRAN/refmans/tidyr/html/separate_wider_delim.html",
  "seq": "https://search.r-project.org/R/refmans/base/html/seq.html",
  "sessionInfo": "https://search.r-project.org/R/refmans/utils/html/sessionInfo.html",
  "set_names": "https://search.r-project.org/CRAN/refmans/rlang/html/set_names.html",
  "setwd": "https://search.r-project.org/R/refmans/base/html/getwd.html",
  "show_query": "https://search.r-project.org/CRAN/refmans/dplyr/html/explain.html",
  "slice_max": "https://search.r-project.org/CRAN/refmans/dplyr/html/slice.html",
  "source": "https://search.r-project.org/R/refmans/base/html/source.html",
  "split": "https://search.r-project.org/R/refmans/base/html/split.html",
  "starts_with": "https://search.r-project.org/CRAN/refmans/tidyselect/html/starts_with.html",
  "stat_count": "https://search.r-project.org/CRAN/refmans/ggplot2/html/geom_bar.html",
  "str": "https://search.r-project.org/R/refmans/utils/html/str.html",
  "str_c": "https://search.r-project.org/CRAN/refmans/stringr/html/str_c.html",
  "str_detect": "https://search.r-project.org/CRAN/refmans/stringr/html/str_detect.html",
  "str_extract": "https://search.r-project.org/CRAN/refmans/stringr/html/str_extract.html",
  "str_flatten": "https://search.r-project.org/CRAN/refmans/stringr/html/str_flatten.html",
  "str_glue": "https://search.r-project.org/CRAN/refmans/stringr/html/str_glue.html",
  "str_length": "https://search.r-project.org/CRAN/refmans/stringr/html/str_length.html",
  "str_replace_all": "https://search.r-project.org/CRAN/refmans/stringr/html/str_replace.html",
  "str_sub": "https://search.r-project.org/CRAN/refmans/stringr/html/str_sub.html",
  "str_to_title": "https://search.r-project.org/CRAN/refmans/stringr/html/case.html",
  "str_to_upper": "https://search.r-project.org/CRAN/refmans/stringr/html/case.html",
  "str_view": "https://search.r-project.org/CRAN/refmans/stringr/html/str_view.html",
  "sum": "https://search.r-project.org/R/refmans/base/html/sum.html",
  "summarize": "https://search.r-project.org/CRAN/refmans/dplyr/html/summarise.html",
  "summary": "https://search.r-project.org/R/refmans/base/html/summary.html",
  "table": "https://search.r-project.org/R/refmans/base/html/table.html",
  "tbl": "https://search.r-project.org/CRAN/refmans/dplyr/html/tbl.html",
  "theme": "https://search.r-project.org/CRAN/refmans/ggplot2/html/theme.html",
  "theme_minimal": "https://search.r-project.org/CRAN/refmans/ggplot2/html/ggtheme.html",
  "tibble": "https://search.r-project.org/CRAN/refmans/tibble/html/tibble.html",
  "today": "https://search.r-project.org/CRAN/refmans/lubridate/html/now.html",
  "tribble": "https://search.r-project.org/CRAN/refmans/tibble/html/tribble.html",
  "unique": "https://search.r-project.org/R/refmans/base/html/unique.html",
  "unnest_longer": "https://search.r-project.org/CRAN/refmans/tidyr/html/unnest_longer.html",
  "unnest_wider": "https://search.r-project.org/CRAN/refmans/tidyr/html/unnest_wider.html",
  "vapply": "https://search.r-project.org/R/refmans/base/html/lapply.html",
  "walk": "https://search.r-project.org/CRAN/refmans/purrr/html/map.html",
  "walk2": "https://search.r-project.org/CRAN/refmans/purrr/html/map2.html",
  "wday": "https://search.r-project.org/CRAN/refmans/lubridate/html/day.html",
  "where": "https://search.r-project.org/CRAN/refmans/tidyselect/html/where.html",
  "with_tz": "https://search.r-project.org/CRAN/refmans/lubridate/html/with_tz.html",
  "writeLines": "https://search.r-project.org/R/refmans/base/html/writeLines.html",
  "write_csv": "https://search.r-project.org/CRAN/refmans/readr/html/write_delim.html",
  "write_rds": "https://search.r-project.org/CRAN/refmans/readr/html/read_rds.html",
  "write_xlsx": "https://search.r-project.org/CRAN/refmans/writexl/html/write_xlsx.html",
  "year": "https://search.r-project.org/CRAN/refmans/lubridate/html/year.html",
  "ymd_hms": "https://search.r-project.org/CRAN/refmans/lubridate/html/ymd_hms.html"
} /* function docs:end */;
  // Each package's home page, linked where lesson text names the package (tools/build_function_docs.py).
  const PACKAGE_DOCS = /* package docs:start */ {
  "DBI": "https://dbi.r-dbi.org",
  "arrow": "https://arrow.apache.org/docs/r/",
  "broom": "https://broom.tidymodels.org/",
  "dbplyr": "https://dbplyr.tidyverse.org/",
  "dplyr": "https://dplyr.tidyverse.org",
  "duckdb": "https://r.duckdb.org/",
  "duckplyr": "https://duckplyr.tidyverse.org",
  "forcats": "https://forcats.tidyverse.org/",
  "fs": "https://fs.r-lib.org",
  "ggplot2": "https://ggplot2.tidyverse.org",
  "ggrepel": "https://ggrepel.slowkow.com/",
  "gt": "https://gt.rstudio.com",
  "hms": "https://hms.tidyverse.org/",
  "janitor": "https://sfirke.github.io/janitor/",
  "jsonlite": "https://jeroen.r-universe.dev/jsonlite",
  "lubridate": "https://lubridate.tidyverse.org",
  "patchwork": "https://patchwork.data-imaginist.com",
  "purrr": "https://purrr.tidyverse.org/",
  "quarto": "https://quarto-dev.github.io/quarto-r/",
  "reactable": "https://glin.github.io/reactable/",
  "readr": "https://readr.tidyverse.org",
  "readxl": "https://readxl.tidyverse.org",
  "reprex": "https://reprex.tidyverse.org",
  "rlang": "https://rlang.r-lib.org",
  "rvest": "https://rvest.tidyverse.org/",
  "scales": "https://scales.r-lib.org",
  "stringr": "https://stringr.tidyverse.org",
  "tibble": "https://tibble.tidyverse.org/",
  "tidyr": "https://tidyr.tidyverse.org",
  "tidyselect": "https://tidyselect.r-lib.org",
  "tidyverse": "https://tidyverse.tidyverse.org",
  "vctrs": "https://vctrs.r-lib.org/",
  "writexl": "https://ropensci.r-universe.dev/writexl"
} /* package docs:end */;
  // Package names that are also everyday words are linked only as code (`scales`), not in prose.
  const PLAIN_WORDS = new Set(['arrow', 'scales', 'gt', 'fs', 'reprex', 'quarto', 'DBI', 'hms', 'vctrs', 'rlang', 'broom']);

  const coach = (window.__rsCoach = {
    loadedAt: Date.now(),
    mounts: 0,
    session: null,
    placement: null,
    demo: null,
    fresh: {count: 0, last: null}, // fresh starts done since the page loaded, and what the last one found
    log: [],
  });
  const note = (type, detail = {}) => {
    coach.log.push({type, at: Date.now(), ...detail});
    if (coach.log.length > 300) coach.log.shift();
  };

  // ---------- RStudio's connection ----------
  // RStudio's page reaches R through requests to /rpc/… (run this code, list these files) and a
  // long poll of /events/… that brings back what R did (Console output, a new chart). On a slow or
  // patchy connection these take seconds, and the coach mustn't give up on R while RStudio is
  // still waiting for an answer. So the coach watches RStudio's requests, from before RStudio loads:
  // which calls are unanswered, when anything last came back, and when a request last failed.
  const net = (coach.net = {rpcs: new Map(), lastAnswer: Date.now(), failures: 0, lastFailure: 0});
  {
    const proto = XMLHttpRequest.prototype;
    const open = proto.open;
    const send = proto.send;
    let id = 0;
    proto.open = function (...args) { this.rsCoachUrl = String(args[1] || ''); return open.apply(this, args); };
    proto.send = function (...args) {
      const url = this.rsCoachUrl || '';
      const kind = /\/rpc\//.test(url) ? 'rpc' : /\/events\//.test(url) ? 'events' : null;
      if (kind) {
        const mine = (id += 1);
        if (kind === 'rpc') net.rpcs.set(mine, {call: url.replace(/^.*\/rpc\//, ''), at: Date.now()});
        this.addEventListener('loadend', () => {
          net.rpcs.delete(mine);
          if (this.status >= 200 && this.status < 400) net.lastAnswer = Date.now();
          else Object.assign(net, {failures: net.failures + 1, lastFailure: Date.now()});
        });
      }
      return send.apply(this, args);
    };
  }
  // How long RStudio has waited on its oldest unanswered call, in ms (0: none waiting).
  const netWaitMs = () => {
    let oldest = Infinity;
    for (const call of net.rpcs.values()) oldest = Math.min(oldest, call.at);
    return oldest === Infinity ? 0 : Date.now() - oldest;
  };
  // The connection, as the coach waits on R: 'offline' (the browser says so), 'slow' (RStudio has
  // waited over 2 s for an answer, or nothing has come back for 8 s while it waits), 'failed' (a
  // request failed in the last 10 s and nothing has come back since), or 'ok'.
  function connection() {
    if (navigator.onLine === false) return 'offline';
    const waiting = netWaitMs();
    if (waiting > 2000 || (waiting && Date.now() - net.lastAnswer > 8000)) return 'slow';
    if (net.lastFailure > net.lastAnswer && Date.now() - net.lastFailure < 10000) return 'failed';
    return 'ok';
  }
  // The connection to RStudio is too slow or broken for R's result to arrive in time.
  class SlowConnection extends Error {}

  // A page that frames RStudio can send Cross-Origin-Opener-Policy: same-origin, as iximiuz Labs
  // does. Then a window RStudio opens from the frame (an image clicked in the Files pane, say) does
  // open, but the browser cuts it off from RStudio, and window.open returns null, as it does for a
  // blocked popup (Chrome, measured 25 November 2026). RStudio says a popup blocker stopped it,
  // which puzzles a learner looking at the image it opened. A popup blocker only stops a window
  // that no click asked for, so a null from an open that a click did ask for, in a frame, is a
  // window that opened: for a few seconds the coach presses Cancel on RStudio's message, before it
  // is drawn. Any other null keeps RStudio's message, with its Try Again.
  const openWindow = window.open;
  window.open = function open(...args) {
    const asked = Boolean(navigator.userActivation?.isActive); // read first: opening a window uses it up
    const win = openWindow.apply(this, args);
    if (win || !asked || window.top === window) return win;
    note('window_cut_off', {url: String(args[0] || '').slice(0, 200)});
    const dismiss = () => {
      for (const dialog of document.querySelectorAll('[role="alertdialog"]')) {
        if (!/popup blocker/i.test(dialog.textContent)) continue;
        const cancel = [...dialog.querySelectorAll('button')].find(b => b.textContent.trim() === 'Cancel');
        if (!cancel) continue;
        cancel.click();
        note('popup_message_closed');
      }
    };
    const watcher = new MutationObserver(dismiss);
    watcher.observe(document.body, {childList: true, subtree: true});
    setTimeout(() => watcher.disconnect(), 5000);
    return win;
  };

  // RStudio (GWT) handles shortcuts such as Ctrl+2 in a capture-phase listener, so
  // stopping propagation at the coach element is too late. This script runs before
  // GWT loads; a window capture listener registered now runs before GWT's and keeps
  // key events aimed at the coach away from RStudio. Default actions (typing) still happen.
  // Spike switch: localStorage.rsCoachNoKeyShield = '1' turns it off for an A/B test.
  let shield = true;
  try { shield = localStorage.getItem('rsCoachNoKeyShield') !== '1'; } catch (_error) { /* storage blocked */ }
  coach.keyShield = shield;
  coach.shieldedEvents = 0;
  // Shortcuts pressed in RStudio, for lessons that teach one (Alt+- for <-, Ctrl+Shift+M for |>).
  // Pressing one leaves nothing R can see, so the coach watches for the keys themselves.
  coach.chords = [];
  coach.chordAt = {}; // each shortcut's last press, which the 50-entry log above could lose
  window.addEventListener('keydown', event => {
    const host = document.getElementById('rs-coach-host');
    if (host && event.composedPath().includes(host)) return;
    // On a Mac, Option+- gives the key "–", but RStudio reads it as Alt+- all the same.
    const key = event.code === 'Minus' ? '-' : event.key.length === 1 ? event.key.toUpperCase() : event.key;
    if (!(event.ctrlKey || event.altKey || event.metaKey) || ['Control', 'Alt', 'Shift', 'Meta'].includes(key)) return;
    const chord = [event.ctrlKey && 'Ctrl', event.metaKey && 'Cmd', event.altKey && 'Alt', event.shiftKey && 'Shift', key].filter(Boolean).join('+');
    coach.chords.push({chord, at: Date.now(), trusted: event.isTrusted});
    coach.chordAt[chord] = Date.now();
    if (coach.chords.length > 50) coach.chords.shift();
  }, true);
  if (shield) {
    for (const type of ['keydown', 'keypress', 'keyup', 'beforeinput', 'input', 'paste', 'copy', 'cut', 'compositionstart', 'compositionupdate', 'compositionend']) {
      window.addEventListener(type, event => {
        const host = document.getElementById('rs-coach-host');
        if (host && event.composedPath().includes(host)) {
          event.stopImmediatePropagation();
          coach.shieldedEvents += 1;
        }
      }, true);
    }
  }

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const shown = el => (el && el.isConnected && el.offsetParent && el.getBoundingClientRect().width > 0 ? el : null);
  const byId = id => shown(document.getElementById(id));
  const setting = (key, fallback) => {
    try { return Number(localStorage.getItem(key)) || fallback; } catch (_error) { return fallback; } // storage blocked
  };
  const paceMs = setting('rsCoachPaceMs', 1000); // pause after opening the script and between steps
  const leadMs = setting('rsCoachLeadMs', 700); // the spotlight arrives this long before the pointer moves
  const dwellMs = setting('rsCoachDwellMs', 2400); // how long Show me holds a result (Demonstration waits for the reader)
  const typeMs = setting('rsCoachTypeMs', 70); // average gap between keystrokes, as in ELK Guide's coach
  // How long Demonstration waits for the learner to read a text before moving on by itself: the
  // minimum for up to 60 characters, plus `readStepMs` each time the text doubles in length.
  const readMinMs = setting('rsCoachReadMinMs', 5000);
  const readStepMs = setting('rsCoachReadStepMs', 3000);
  const readMs = text => Math.round(readMinMs + readStepMs * Math.log2(Math.max(1, readable(text).length / 60)));

  // RStudio Server 2026.11.0+203 anchors. Presentation and demo driving only.
  const ide = {
    sidebar: () => byId('rstudio_Sidebar_pane'),
    console: () => byId('rstudio_Console_pane') || byId('rstudio_workbench_panel_console'),
    consoleText: () => document.getElementById('rstudio_console_output')?.textContent || '',
    source: () => byId('rstudio_Source_pane'),
    consoleClear: () => byId('rstudio_tb_consoleclear'),
    files: () => byId('rstudio_workbench_panel_files'),
    filesTab: () => byId('rstudio_workbench_tab_files'),
    filesHome: () => [...document.querySelectorAll('#rstudio_workbench_panel_files button[title="Go to project directory"]')].find(shown),
    plots: () => byId('rstudio_workbench_panel_plots'),
    plotsTab: () => byId('rstudio_workbench_tab_plots'),
    environment: () => byId('rstudio_workbench_panel_environment'),
    // RStudio removes this label once the global environment holds an object (shown or not).
    environmentEmpty: () => [...(document.getElementById('rstudio_workbench_panel_environment')?.querySelectorAll('*') || [])]
      .some(el => el.childElementCount === 0 && el.textContent.trim() === 'Environment is empty'),
    chartShown: () => {
      const img = ide.plotImage();
      return Boolean(img && img.naturalWidth > 0 && img.ownerDocument.defaultView.getComputedStyle(img).display !== 'none');
    },
    runButton: () => ide.sourceButton(/^Run\b/),
    // A Quarto document's toolbar has a Run menu (Run Selected Line(s), Run Current Chunk…) instead.
    runMenu: () => [...document.querySelectorAll('#rstudio_Source_pane button[aria-haspopup="true"]')].find(b => shown(b) && b.textContent.trim() === 'Run'),
    saveButton: () => ide.sourceButton(/^Save current document\b/),
    sourceRunButton: () => byId('rstudio_text_source') || ide.sourceButton(/^Source the contents\b/),
    projectMenu: () => byId('rstudio_project_menubutton_toolbar'),
    consoleTab: () => [...document.querySelectorAll('[role="tab"]')].find(t => shown(t) && t.textContent.trim().replace(/\s*×$/, '') === 'Console'),
    // An element in `scope` showing exactly `text` and nothing else (a wizard's choice, a pane's name).
    leaf: (scope, text) => scope && [...scope.querySelectorAll('*')].find(el => el.childElementCount === 0 && shown(el) && el.textContent.trim() === text),
    sourceButton: title => [...document.querySelectorAll('#rstudio_Source_pane button')]
      .find(b => shown(b) && title.test(b.getAttribute('title') || '')),
    sourceTab: name => [...document.querySelectorAll('#rstudio_Source_pane [role="tab"]')]
      .find(t => shown(t) && t.textContent.trim().replace(/\*$/, '') === name),
    unsaved: name => (ide.sourceTab(name)?.innerText || '').includes('*'),
    // The editor for `name`, once its tab is the one shown in the Source pane.
    scriptEditor: name => (ide.sourceTab(name)?.getAttribute('aria-selected') === 'true' ? ide.activeEditor() : null),
    fileLink: name => {
      const panel = ide.files();
      return panel && [...panel.querySelectorAll('*')].find(el => el.childElementCount === 0 && el.textContent.trim() === name && shown(el));
    },
    activeEditor: () => {
      const el = [...document.querySelectorAll('#rstudio_Source_pane .ace_editor')].find(e => shown(e) && e.env && e.env.editor);
      return el ? el.env.editor : null;
    },
    // The main menu bar's item `name`, and an open menu's item whose text matches `re`.
    menubar: name => [...document.querySelectorAll('[role="menubar"] [role="menuitem"]')].find(e => shown(e) && e.textContent.trim() === name),
    menuItem: re => [...document.querySelectorAll('[role="menu"] [role="menuitem"]')].find(e => shown(e) && re.test(e.textContent.trim().replace(/\s+/g, ' '))),
    dialog: re => [...document.querySelectorAll('.gwt-DialogBox, [role="dialog"], [role="alertdialog"]')].find(d => shown(d) && re.test(d.textContent)),
    dialogButton: (dialog, label) => dialog && [...dialog.querySelectorAll('button')].find(b => shown(b) && b.textContent.trim() === label),
    viewer: () => byId('rstudio_workbench_panel_viewer'),
    help: () => byId('rstudio_workbench_panel_help'),
    viewerTab: () => byId('rstudio_workbench_tab_viewer'),
    viewerShows: () => [...document.querySelectorAll('#rstudio_workbench_panel_viewer iframe')].some(frame => {
      try { return Boolean(frame.contentDocument?.body?.innerText.trim()); } catch (_error) { return false; }
    }),
    helpTitle: () => {
      for (const frame of document.querySelectorAll('#rstudio_workbench_panel_help iframe')) {
        try { const h = frame.contentDocument?.querySelector('h2'); if (h) return h.textContent.trim(); } catch (_error) { /* not same-origin */ }
      }
      return null;
    },
    visualEditor: () => [...document.querySelectorAll('#rstudio_Source_pane .ProseMirror')].find(shown),
    plotImage: () => {
      for (const frame of document.querySelectorAll('#rstudio_workbench_panel_plots iframe')) {
        try {
          const img = frame.contentDocument && frame.contentDocument.querySelector('img');
          if (img) return img;
        } catch (_error) { /* not same-origin */ }
      }
      return null;
    },
  };

  const centre = el => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {x: r.left + r.width / 2, y: r.top + r.height / 2};
  };

  // GWT toolbar buttons and links act on mousedown/mouseup, so a bare .click() is ignored.
  // The events carry the coordinates of the coach's pointer, which is where the learner sees the click.
  const PRESS = ['pointerover', 'mouseover', 'pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'];
  function press(el, at, types = PRESS) {
    const r = el.getBoundingClientRect();
    const inside = at && at.x >= r.left && at.x <= r.right && at.y >= r.top && at.y <= r.bottom;
    const point = inside ? at : centre(el);
    const init = {bubbles: true, cancelable: true, composed: true, view: window, button: 0, buttons: 1,
      clientX: point.x, clientY: point.y, pointerId: 1, pointerType: 'mouse', isPrimary: true};
    for (const type of types) {
      el.dispatchEvent(type.startsWith('pointer') ? new PointerEvent(type, init) : new MouseEvent(type, init));
    }
  }
  // A shortcut such as "Ctrl+Shift+M" or "Alt+-", sent as key events (RStudio acts on synthetic ones).
  function sendKeys(target, keys) {
    const parts = keys.split('+');
    const name = parts.pop();
    const named = {'-': ['Minus', 189], Enter: ['Enter', 13]}[name];
    const init = {bubbles: true, cancelable: true, composed: true, view: window,
      key: name, code: named ? named[0] : `Key${name.toUpperCase()}`, keyCode: named ? named[1] : name.toUpperCase().charCodeAt(0),
      ctrlKey: parts.includes('Ctrl'), shiftKey: parts.includes('Shift'), altKey: parts.includes('Alt'), metaKey: parts.includes('Cmd')};
    init.which = init.keyCode;
    for (const type of ['keydown', 'keypress', 'keyup']) target.dispatchEvent(new KeyboardEvent(type, init));
  }

  // ---------- overlay (its own layer, above every RStudio pane) ----------
  // While the coach works RStudio, the IDE is dimmed except for a spotlight on what it acts on,
  // and the coach panel stays bright so its narration can be read. A result the coach explains
  // keeps an evidence ring (no dimming) while the learner reads. Both rings arrive the way ELK
  // Guide's do: wide, closing in on their target, then one pulse.
  const overlay = {host: null, box: null, dim: null, spot: null, target: null, until: 0, frame: 0};
  const spot = {find: null, box: null, fresh: false, frame: 0};
  // The coach's pointer during a demonstration. Its tip is at the element's origin.
  const pointer = {el: null, x: null, y: null};
  function ensureOverlay() {
    if (overlay.host && overlay.host.isConnected) return;
    overlay.host = document.createElement('div');
    overlay.host.id = 'rs-coach-overlay';
    const root = overlay.host.attachShadow({mode: 'open'});
    root.innerHTML = `<style>
      :host { all: initial; }
      .dim { position: fixed; inset: 0; z-index: 2147482990; pointer-events: none; background: rgba(16,24,32,.5);
        opacity: 0; transition: opacity .35s ease-out; }
      .dim.on { opacity: 1; }
      .box, .spot { --ring: #ffb000; --ring-edge: #b86e00; --ring-glow: #ffb00066; position: fixed; box-sizing: border-box;
        border-radius: 7px; pointer-events: none; }
      .box { z-index: 2147482995; } /* no fill: it would tint a chart under the ring */
      .spot { z-index: 2147482998; }
      .box::before, .box::after, .spot::before, .spot::after { content: ""; position: absolute; inset: 0; box-sizing: border-box; border-radius: inherit; }
      .box::before, .spot::before { border: 3px solid var(--ring); box-shadow: 0 0 0 1px var(--ring-edge), inset 0 0 0 1px #fffc, 0 0 16px 3px var(--ring-glow); }
      .entering { animation: ring-flash .6s .34s ease-out both; }
      .entering::before { animation: ring-close .7s cubic-bezier(.34,1.4,.64,1) both; }
      .entering::after { border: 3px solid var(--ring); box-shadow: 0 0 12px var(--ring-glow); animation: ring-pulse .8s .4s cubic-bezier(.2,.6,.3,1) both; }
      @keyframes ring-close { from { inset: -28px; border-radius: 18px; opacity: 0; box-shadow: 0 0 0 1px var(--ring-edge), inset 0 0 0 1px #fffc, 0 0 30px 10px var(--ring-glow); } 18% { opacity: 1; } }
      @keyframes ring-flash { from { background-color: #ffb00000; } 30% { background-color: #ffb00059; } }
      @keyframes ring-pulse { from { inset: 0; opacity: 0; } 6% { opacity: 1; } 45% { opacity: .6; } to { inset: -20px; border-radius: 20px; opacity: 0; } }
      @keyframes ring-fade { from { opacity: 0; } }
      .pointer { position: fixed; left: 0; top: 0; z-index: 2147483647; pointer-events: none;
        opacity: 0; transition: opacity .18s; will-change: transform; }
      .pointer.visible { opacity: 1; }
      .pointer svg { position: absolute; left: -1px; top: -1px; display: block; overflow: visible;
        transform-origin: 1px 1px; transition: transform .09s; filter: drop-shadow(0 2px 2px rgba(0,0,0,.35)); }
      .pointer.down svg { transform: scale(.82); }
      .ring { position: absolute; left: -14px; top: -14px; width: 28px; height: 28px; box-sizing: border-box;
        border: 2px solid #bf8700; border-radius: 50%; opacity: 0; }
      .pointer.clicked .ring { animation: ring .5s ease-out; }
      @keyframes ring { from { opacity: 1; transform: scale(.3); } to { opacity: 0; transform: scale(1.7); } }
      .link { position: fixed; inset: 0; width: 100vw; height: 100vh; z-index: 2147482996; pointer-events: none; overflow: visible; }
      .link rect { fill: #cf222e14; stroke: #cf222e; stroke-width: 2.5; }
      .link path { fill: none; stroke: #cf222e; stroke-width: 2.5; stroke-dasharray: 6 5; animation: link-flow 1s linear infinite; }
      .link circle { fill: #cf222e; }
      @keyframes link-flow { to { stroke-dashoffset: -11; } }
      @media (prefers-reduced-motion: reduce) {
        .link path { animation: none; }
        .dim, .pointer, .pointer svg { transition: none; } .pointer.clicked .ring { animation: none; }
        .entering { animation: ring-fade .25s ease-out both !important; } .entering::before { animation: none !important; }
        .entering::after { animation: none !important; border: 0; }
      }
    </style><div class="dim"></div><div class="box" hidden></div><div class="spot" hidden></div>
    <svg class="link" hidden aria-hidden="true"><rect class="said" rx="4"></rect><rect class="wrote" rx="4"></rect>
      <path></path><circle r="4"></circle></svg>
    <div class="pointer" aria-hidden="true"><span class="ring"></span>
      <svg width="22" height="30" viewBox="0 0 22 30"><path d="M1 1v22l5.6-5.4 4 9.4 3.7-1.6-4-9.2H18z"
        fill="#bf8700" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg></div>`;
    overlay.box = root.querySelector('.box');
    overlay.dim = root.querySelector('.dim');
    overlay.spot = root.querySelector('.spot');
    overlay.link = root.querySelector('.link');
    pointer.el = root.querySelector('.pointer');
    for (const ring of [overlay.box, overlay.spot]) {
      ring.addEventListener('animationend', event => {
        if (event.animationName === 'ring-pulse' || event.animationName === 'ring-fade') ring.classList.remove('entering');
      });
    }
    if (pointer.x !== null) placePointer(pointer.x, pointer.y);
    document.body.appendChild(overlay.host);
  }
  function placePointer(x, y) {
    pointer.x = x;
    pointer.y = y;
    pointer.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
  }
  function showPointer(on) {
    ensureOverlay();
    pointer.el.classList.toggle('visible', on);
  }
  // Put the pointer where the learner just clicked, unless it is already on screen.
  function pointerFrom(el) {
    ensureOverlay();
    const at = centre(el);
    if (at && !pointer.el.classList.contains('visible')) placePointer(at.x, at.y);
  }
  const reducedMotion = () => {
    try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_error) { return false; }
  };
  // rAF stalls in a hidden tab; the timeout keeps a glide (which is timed, not frame-counted) finishing.
  const nextFrame = () => new Promise(resolve => {
    const timer = setTimeout(() => { cancelAnimationFrame(frame); resolve(); }, 100);
    const frame = requestAnimationFrame(() => { clearTimeout(timer); resolve(); });
  });
  // Glide along a slight curve, easing in and out, the way a hand moves a mouse. `point()` is read
  // every frame, so the pointer still lands on a target that moves while it travels (a pane resizing).
  async function glide(point, check) {
    let to = point();
    if (!to) return false;
    showPointer(true);
    if (pointer.x === null) placePointer(to.x + 120, to.y + 80);
    const from = {x: pointer.x, y: pointer.y};
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    const duration = reducedMotion() || distance < 2 ? 0 : Math.min(1000, 260 + distance * 0.6);
    const bend = (Math.random() < 0.5 ? -1 : 1) * Math.min(48, distance * 0.14);
    const started = performance.now();
    for (;;) {
      to = point() || to;
      const t = duration ? Math.min(1, (performance.now() - started) / duration) : 1;
      const e = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const length = Math.hypot(dx, dy) || 1;
      const cx = from.x + dx / 2 - (dy / length) * bend;
      const cy = from.y + dy / 2 + (dx / length) * bend;
      const u = 1 - e;
      placePointer(u * u * from.x + 2 * u * e * cx + e * e * to.x, u * u * from.y + 2 * u * e * cy + e * e * to.y);
      if (t >= 1) return true;
      await nextFrame();
      check();
    }
  }
  function pointerClickEffect() {
    const el = pointer.el;
    el.classList.remove('clicked');
    void el.offsetWidth; // restart the ring animation
    el.classList.add('clicked', 'down');
    setTimeout(() => el.classList.remove('down'), 110);
  }
  // A target is an element, or a function returning one or a rectangle ({left, top, right, bottom}).
  function targetRect(target) {
    const found = typeof target === 'function' ? target() : target;
    if (!found) return null;
    if (found instanceof Element) return shown(found) ? found.getBoundingClientRect() : null;
    return found;
  }
  const sameBox = (a, b) => Boolean(a && b) && ['left', 'top', 'width', 'height'].every(side => Math.abs(a[side] - b[side]) < 2);
  function placeRing(ring, r, pad, arriving) {
    const box = {left: r.left - pad, top: r.top - pad, width: r.right - r.left + 2 * pad, height: r.bottom - r.top + 2 * pad};
    Object.assign(ring.style, {left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px`});
    ring.hidden = false;
    if (arriving) {
      ring.classList.remove('entering');
      void ring.offsetWidth; // restart the entrance
      ring.classList.add('entering');
    }
    return box;
  }

  // Dim RStudio except `target` and the coach panel, with a ring on `target`. The spotlight
  // follows its target every frame (a line growing as it is typed, a pane scrolling); a new
  // target replays the ring's entrance. null lifts the dimming.
  function spotlight(target) {
    ensureOverlay();
    cancelAnimationFrame(spot.frame);
    spot.find = target || null;
    spot.fresh = true;
    if (!target) {
      overlay.dim.classList.remove('on');
      overlay.spot.hidden = true;
      spot.box = null;
      return;
    }
    const tick = () => {
      if (!spot.find) return;
      const r = targetRect(spot.find);
      if (r) {
        const pad = 6;
        const next = {left: r.left - pad, top: r.top - pad, width: r.right - r.left + 2 * pad, height: r.bottom - r.top + 2 * pad};
        const arriving = spot.fresh && (overlay.spot.hidden || !sameBox(next, spot.box));
        spot.box = placeRing(overlay.spot, r, pad, arriving);
        spot.fresh = false;
        overlay.dim.style.clipPath = dimPath(spot.box);
        overlay.dim.classList.add('on');
      }
      spot.frame = requestAnimationFrame(tick);
    };
    tick();
  }
  // The dimming covers the window except two holes: the spotlight (rounded) and the coach panel.
  function dimPath(b) {
    const w = innerWidth;
    const h = innerHeight;
    const k = Math.min(7, b.width / 2, b.height / 2);
    const x = b.left;
    const y = b.top;
    const x2 = b.left + b.width;
    const y2 = b.top + b.height;
    let d = `M0 0H${w}V${h}H0Z M${x + k} ${y}H${x2 - k}A${k} ${k} 0 0 1 ${x2} ${y + k}V${y2 - k}A${k} ${k} 0 0 1 ${x2 - k} ${y2}H${x + k}A${k} ${k} 0 0 1 ${x} ${y2 - k}V${y + k}A${k} ${k} 0 0 1 ${x + k} ${y}Z`;
    const panel = coach.host?.shadowRoot?.querySelector('.panel')?.getBoundingClientRect();
    if (panel && panel.width) d += ` M${panel.left} ${panel.top}H${panel.right}V${panel.bottom}H${panel.left}Z`;
    return `path(evenodd, "${d.replace(/\d+\.\d+/g, n => Number(n).toFixed(1))}")`;
  }

  // An evidence ring without dimming, on `target` for `ms` (Infinity: until cleared).
  function highlight(target, ms = 2500) {
    ensureOverlay();
    const arriving = target !== overlay.target || overlay.box.hidden;
    overlay.target = target || null;
    overlay.until = Date.now() + ms;
    cancelAnimationFrame(overlay.frame);
    let first = arriving;
    const tick = () => {
      const r = overlay.target && Date.now() <= overlay.until ? targetRect(overlay.target) : null;
      if (!r) {
        overlay.box.hidden = true;
        overlay.box.classList.remove('entering');
        if (!overlay.target || Date.now() > overlay.until) { overlay.target = null; return; }
      } else {
        placeRing(overlay.box, r, 3, first);
        first = false;
      }
      overlay.frame = requestAnimationFrame(tick);
    };
    tick();
    return !overlay.box.hidden;
  }
  const clearHighlight = () => highlight(null, 0);

  // A link between a name in R's message and the same name in the learner's code (Guided): a box
  // round each and a line between them, following both every frame (the Console scrolls, the editor
  // moves). `said` and `wrote` return rectangles; either can be missing, and then only the other is
  // boxed. linkWord(null) takes it away.
  const link = {said: null, wrote: null, frame: 0};
  function linkWord(said, wrote) {
    ensureOverlay();
    Object.assign(link, {said, wrote});
    cancelAnimationFrame(link.frame);
    const svg = overlay.link;
    const tick = () => {
      const a = link.said?.();
      const b = link.wrote?.();
      svg.hidden = !a && !b;
      const place = (rect, r) => {
        rect.style.display = r ? '' : 'none';
        if (r) for (const [k, v] of Object.entries({x: r.left - 3, y: r.top - 2, width: r.right - r.left + 6, height: r.bottom - r.top + 4})) rect.setAttribute(k, v);
      };
      place(svg.querySelector('.said'), a);
      place(svg.querySelector('.wrote'), b);
      const path = svg.querySelector('path');
      const dot = svg.querySelector('circle');
      if (a && b) {
        // From the middle of the message's word to the middle of the code's word, bowed sideways.
        const from = {x: (a.left + a.right) / 2, y: a.top - 2};
        const to = {x: (b.left + b.right) / 2, y: b.bottom + 2};
        const bow = Math.max(40, Math.abs(to.x - from.x) / 3);
        path.setAttribute('d', `M${from.x},${from.y} C${from.x - bow},${(from.y + to.y) / 2} ${to.x - bow},${(from.y + to.y) / 2} ${to.x},${to.y}`);
        dot.setAttribute('cx', to.x);
        dot.setAttribute('cy', to.y);
        path.style.display = dot.style.display = '';
      } else {
        path.style.display = dot.style.display = 'none';
      }
      if (link.said || link.wrote) link.frame = requestAnimationFrame(tick);
    };
    if (said || wrote) tick(); else svg.hidden = true;
  }
  // The rectangle of characters `from`..`to` of an element's text, clipped to the scrolled box it is
  // in; null when that part is scrolled out of view.
  function textRect(el, from, to) {
    if (!el || from < 0) return null;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    let pos = 0;
    let started = false;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const len = node.nodeValue.length;
      if (!started && pos + len > from) { range.setStart(node, from - pos); started = true; }
      if (started && pos + len >= to) { range.setEnd(node, to - pos); break; }
      pos += len;
    }
    if (!started) return null;
    const r = [...range.getClientRects()].find(rect => rect.width > 0) || range.getBoundingClientRect();
    let box = el;
    while (box && box !== document.body && !/auto|scroll/.test(getComputedStyle(box).overflowY)) box = box.parentElement;
    const clip = (box || el).getBoundingClientRect();
    return r.width && r.top >= clip.top - 1 && r.bottom <= clip.bottom + 1 ? {left: r.left, top: r.top, right: r.right, bottom: r.bottom} : null;
  }
  // Where `name` stands as a whole word in `text`, between `start` and `before`: every place, in
  // order (wordsAt), or the last (wordAt).
  function wordsAt(text, name, start = 0, before = text.length) {
    const re = new RegExp(`(?<![\\w.])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w])`, 'g');
    return [...text.slice(start, before).matchAll(re)].map(m => start + m.index);
  }
  const wordAt = (text, name, start, before) => wordsAt(text, name, start, before).pop() ?? -1;
  // The word in R's message (the newest Console text after the statement's echo), and the word in the
  // code: in the script when the statement is there, otherwise in the Console's echo of it.
  function linkName(name, code) {
    if (!name) { linkWord(null, null); return; }
    const out = () => document.getElementById('rstudio_console_output');
    const echo = echoOf(code);
    // The newest place on screen: RStudio's error box also holds a hidden copy of the message.
    const said = () => {
      const text = out()?.textContent || '';
      const at = text.lastIndexOf(echo);
      if (at < 0) return null;
      for (const i of wordsAt(text, name, at + echo.length).reverse()) {
        const r = textRect(out(), i, i + name.length);
        if (r) return r;
      }
      return null;
    };
    const wrote = () => {
      const editor = ide.activeEditor();
      const lines = editor ? editor.session.getDocument().getAllLines() : [];
      const top = lines.findIndex(line => line.trim() === code.split('\n')[0].trim());
      if (top >= 0) { // the statement is in the script: run from there
        for (let row = top; row < lines.length && row < top + code.split('\n').length; row += 1) {
          const col = wordAt(lines[row], name);
          if (col < 0) continue;
          const renderer = editor.renderer;
          const at = renderer.textToScreenCoordinates(row, col);
          const box = renderer.scroller.getBoundingClientRect();
          const r = {left: at.pageX, top: at.pageY, right: at.pageX + name.length * renderer.characterWidth, bottom: at.pageY + renderer.lineHeight};
          if (r.top >= box.top - 1 && r.bottom <= box.bottom + 1 && r.left >= box.left - 1) return r;
          return null; // there, but scrolled out of view
        }
      }
      const text = out()?.textContent || '';
      const at = text.lastIndexOf(echo);
      if (at < 0) return null;
      const i = wordAt(text, name, at, at + echo.length);
      return i < 0 ? null : textRect(out(), i, i + name.length);
    };
    linkWord(said, wrote);
  }

  // ---------- panel ----------
  // Type scale (accessibility audit, 24 November 2026): 15px for what the learner reads (narration,
  // explanations, tasks, hints), 14px for secondary text, never below 13px. Every control shows a
  // focus ring, and small link-style buttons are at least 24px tall.
  const css = `
    :host { all: initial; }
    :host([data-placement="docked"]) { position: absolute; inset: 0; z-index: 1000; } /* above the pane's own maximize/close icons */
    .panel { position: fixed; right: 16px; bottom: 16px; z-index: 2147483000; width: 360px;
      max-height: calc(100vh - 32px); display: flex; flex-direction: column; box-sizing: border-box;
      font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; color: #1f2328;
      background: #fff; border: 1px solid #d0d7de; border-radius: 10px;
      box-shadow: 0 8px 24px rgba(31,35,40,.18); overflow: hidden; }
    :host([data-placement="docked"]) .panel { position: absolute; inset: 0; width: auto; max-height: none;
      border-radius: 0; box-shadow: none; border-width: 0 0 0 1px; }
    .panel.collapsed .body { display: none; }
    header { display: flex; align-items: center; gap: 8px; padding: 8px 14px;
      background: #0b5cad; color: #fff; cursor: move; user-select: none; }
    :host([data-placement="docked"]) header { cursor: default; }
    :host([data-placement="docked"]) .collapse { display: none; }
    header strong { flex: 1; font-size: 15px; }
    header .mode { font-size: 13px; background: rgba(0,0,0,.25); padding: 1px 9px; border-radius: 9px; }
    header button { all: unset; cursor: pointer; padding: 2px 8px; font-size: 18px; line-height: 1; border-radius: 4px; }
    header button:focus-visible { outline: 2px solid #fff; outline-offset: 1px; }
    .body { padding: 14px; overflow: auto; display: grid; gap: 14px; align-content: start; flex: 1; }
    .content, .overview { display: grid; gap: 12px; }
    .lesson-work { display: grid; gap: 14px; }
    .lesson-work[hidden], .lesson-preview[hidden] { display: none; }
    .lesson-preview { display: grid; gap: 12px; }
    h2 { margin: 0; font-size: 19px; line-height: 1.3; }
    h3 { margin: 0; font-size: 16px; line-height: 1.35; }
    p { margin: 0; }
    a { color: #0b5cad; }
    a.doc-link { text-decoration: underline; text-underline-offset: 2px; }
    a:focus-visible { outline: 2px solid #0b5cad; outline-offset: 2px; border-radius: 2px; }
    .muted { color: #57606a; font-size: 14px; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: max(.9em, 13px); background: #f0f3f6; padding: 1px 4px; border-radius: 4px; overflow-wrap: anywhere; }
    strong code { font-weight: 600; }
    ol { margin: 0; padding-left: 22px; display: grid; gap: 6px; }
    li.done { color: #1a7f37; }
    li.done::marker { content: "✓  "; }
    li.active { font-weight: 600; color: #0b5cad; }
    li.active::marker { content: "▶  "; }
    li.failed { color: #cf222e; font-weight: 600; }
    li.failed::marker { content: "✕  "; }
    label { display: grid; gap: 4px; font-weight: 600; }
    textarea { font: inherit; font-weight: 400; min-height: 54px; resize: vertical; padding: 6px; border: 1px solid #d0d7de; border-radius: 6px; }
    .row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .row button { font: inherit; padding: 5px 11px; min-height: 34px; border-radius: 6px; border: 1px solid #8c959f; background: #f6f8fa; color: #1f2328; cursor: pointer; }
    .row button:focus-visible, .mode-card:focus-visible, .lesson-card:focus-visible { outline: 2px solid #0b5cad; outline-offset: 2px; }
    .row button.primary { background: #1a7f37; color: #fff; border-color: #1a7f37; font-weight: 600; }
    .row button:disabled { opacity: .55; cursor: default; }
    .card { border: 1px solid #d0d7de; border-radius: 8px; padding: 12px 14px; display: grid; gap: 10px; background: #f6f8fa; }
    .card code { background: #fff; }
    .phase { font-size: 15px; color: #1f2328; background: #fff8e1; border-left: 4px solid #ffb000;
      padding: 8px 10px; border-radius: 4px; }
    .phase.new { animation: phase-in .35s ease-out; }
    @keyframes phase-in { from { opacity: 0; transform: translateY(3px); } }
    @media (prefers-reduced-motion: reduce) { .phase.new { animation: none; } }
    .phase:empty, .explain:empty { display: none; }
    /* ELK Guide's countdown bar: it fills while the learner reads, and sweeps while the coach acts. */
    .timer { height: 5px; border-radius: 3px; background: #d6e4f2; overflow: hidden; }
    .timer span { display: block; height: 100%; width: 0; background: #0b5cad; border-radius: 3px; }
    .timer.working { background: #f3e3b8; }
    .timer.working span { width: 34% !important; background: #d98c00; animation: timer-sweep 1.25s cubic-bezier(.55,0,.45,1) infinite; }
    @keyframes timer-sweep { from { transform: translateX(-115%); } to { transform: translateX(310%); } }
    @media (prefers-reduced-motion: reduce) {
      .timer.working span { animation: none; transform: none; width: 100% !important; opacity: .55; }
      .timer span { transition: none !important; }
    }
    /* Explanations: short paragraphs with room between them, and the odd list. */
    .explain, .prose { display: grid; gap: 10px; }
    .explain ul, .prose ul { margin: 0; padding-left: 20px; display: grid; gap: 4px; }
    .explain strong { color: #0b5cad; }
    .note { font-size: 14px; font-weight: 400; color: #1f2328; background: #eef6ff; border-left: 4px solid #0b5cad; padding: 8px 10px; border-radius: 4px; }
    .note strong { color: inherit; }
    .error { color: #cf222e; }
    .status { font-size: 14px; color: #57606a; min-height: 1.4em; }
    .ended { font-weight: 600; }
    .pick { display: grid; gap: 8px; }
    .pick-label { font-weight: 600; font-size: 16px; }
    .mode-card { all: unset; box-sizing: border-box; display: grid; grid-template-columns: 26px 1fr; gap: 1px 8px;
      padding: 8px 12px; border: 1px solid #d0d7de; border-radius: 8px; background: #fff; cursor: pointer; }
    .mode-card:hover { border-color: #0b5cad; background: #f3f8fe; }
    .mode-card .icon { grid-row: span 2; align-self: center; text-align: center; font-size: 20px; color: #0b5cad; }
    .mode-card strong { font-size: 16px; color: #0b5cad; }
    .mode-card .what { color: #57606a; font-size: 14px; line-height: 1.4; }
    .lesson-card { all: unset; box-sizing: border-box; display: grid; grid-template-columns: 16px 1fr; gap: 0 8px; align-items: center;
      padding: 6px 10px; border: 1px solid #d0d7de; border-radius: 8px; background: #fff; cursor: pointer; }
    .lesson-card:hover { border-color: #0b5cad; }
    .lesson-card[aria-checked="true"] { border-color: #0b5cad; background: #f3f8fe; }
    .lesson-card .dot { grid-row: span 2; width: 12px; height: 12px; box-sizing: border-box; border: 2px solid #6e7781; border-radius: 50%; }
    .lesson-card[aria-checked="true"] .dot { border: 4px solid #0b5cad; }
    .lesson-card strong { font-size: 15px; }
    .lesson-card .what { grid-column: 2; color: #57606a; font-size: 14px; }
    .row button.switch { margin-left: auto; background: none; border-color: transparent; color: #0b5cad; text-decoration: underline; text-underline-offset: 2px; }
    .lesson-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
    .lesson-row p { margin: 0; }
    .lesson-title { font-size: 18px; }
    .lesson-list { display: grid; gap: 2px; border: 1px solid #d0d7de; border-radius: 8px; padding: 4px 8px; background: #f6f8fa; }
    .lesson-list summary { font-size: 14px; min-height: 24px; display: flex; align-items: center; }
    .lesson-list ul { list-style: none; margin: 2px 0 4px; padding: 0; display: grid; gap: 1px; }
    .lesson-pick { all: unset; box-sizing: border-box; display: grid; grid-template-columns: 22px 1fr auto 14px; gap: 6px; align-items: baseline;
      width: 100%; min-height: 26px; padding: 2px 6px; border-radius: 6px; cursor: pointer; }
    .lesson-pick:hover { background: #fff; }
    .lesson-pick:focus-visible { outline: 2px solid #0b5cad; outline-offset: 1px; }
    .lesson-pick[aria-current="true"] { background: #fff; box-shadow: inset 0 0 0 1px #0b5cad; }
    .lesson-pick .num { color: #57606a; text-align: right; font-variant-numeric: tabular-nums; }
    .lesson-pick .what { color: #57606a; font-size: 13px; }
    .lesson-pick .tick, .done-mark { color: #1a7f37; font-weight: 600; }
    .done-mark { font-size: 13px; }
    .lesson-summary { color: #1f2328; }
    .tasks { padding-left: 20px; }
    .task-count { font-size: 14px; font-weight: 600; color: #0b5cad; }
    .task-count:empty { display: none; }
    .task-count.new { animation: phase-in .35s ease-out; }
    @media (prefers-reduced-motion: reduce) { .task-count.new { animation: none; } }
    .task-num { font-weight: 600; }
    .hints { display: grid; gap: 6px; }
    .hint-text { font-size: 15px; }
    pre.code { margin: 4px 0 0; padding: 6px 8px; font: 14px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace;
      background: #fff; border: 1px solid #d0d7de; border-radius: 4px; white-space: pre; overflow-x: auto; }
    .feedback { color: #8a5c00; }
    .feedback:empty, .hints:empty { display: none; }
    .stats { margin: 0; padding-left: 20px; display: grid; gap: 4px; }
    .solo-steps { gap: 10px; }
    .solo-steps .tasks { margin-top: 4px; font-weight: 400; display: grid; gap: 6px; }
    .solo-steps .note { margin-top: 4px; }
    li.missing { color: #8a5c00; }
    li.missing::marker { content: "○  "; }
    button.link { all: unset; cursor: pointer; color: #0b5cad; font-size: 14px; text-decoration: underline; text-underline-offset: 2px;
      display: inline-flex; align-items: center; min-height: 24px; padding: 0 4px; border-radius: 4px; }
    button.link:focus-visible, summary:focus-visible { outline: 2px solid #0b5cad; outline-offset: 1px; }
    details summary { cursor: pointer; font-weight: 600; }
    details.steps-box > summary { color: #0b5cad; font-size: 14px; min-height: 24px; }
    details.steps-box[open] > summary { margin-bottom: 6px; }
    h4 { margin: 10px 0 4px; font-size: 15px; }
    /* Auto-advance: a switch, off by default, beside Stop. */
    .row.controls button.stop { margin-left: auto; }
    .row button.auto { all: unset; box-sizing: border-box; display: inline-flex; align-items: center; gap: 8px; min-height: 30px;
      padding: 0 2px; cursor: pointer; font-size: 14px; color: #1f2328; border-radius: 6px; }
    .row button.auto:focus-visible { outline: 2px solid #0b5cad; outline-offset: 2px; }
    .auto .track { position: relative; width: 34px; height: 20px; border-radius: 10px; background: #6e7781; flex: none; transition: background .15s; }
    .auto .track::after { content: ""; position: absolute; top: 3px; left: 3px; width: 14px; height: 14px; border-radius: 50%; background: #fff; transition: transform .15s; }
    .auto[aria-checked="true"] .track { background: #1a7f37; }
    .auto[aria-checked="true"] .track::after { transform: translateX(14px); }
    @media (prefers-reduced-motion: reduce) { .auto .track, .auto .track::after { transition: none; } }
    [hidden] { display: none !important; }
  `;

  function mount() {
    if (coach.host) return;
    coach.mounts += 1;
    const host = document.createElement('div');
    host.id = 'rs-coach-host';
    coach.host = host;
    const root = host.attachShadow({mode: 'open'});
    root.innerHTML = `
      <style>${css}</style>
      <section class="panel" role="complementary" aria-label="Coach">
        <header>
          <strong>Coach</strong><span class="mode">…</span>
          <button class="collapse" title="Collapse" aria-label="Collapse coach">–</button>
        </header>
        <div class="body">
          <div class="content"></div>
          <div class="status" aria-live="polite">Connecting to the coach service…</div>
        </div>
      </section>`;
    document.body.appendChild(host);
    place();

    const panel = root.querySelector('.panel');
    root.querySelector('.collapse').addEventListener('click', () => {
      panel.classList.toggle('collapsed');
      note('collapse', {collapsed: panel.classList.contains('collapsed')});
    });
    // Drag by the header (floating only) so the learner can move the panel off a pane.
    root.querySelector('header').addEventListener('pointerdown', event => {
      if (host.dataset.placement !== 'floating' || event.target.closest('button')) return;
      const start = {x: event.clientX, y: event.clientY, rect: panel.getBoundingClientRect()};
      const move = e => Object.assign(panel.style, {
        left: `${Math.max(0, start.rect.left + e.clientX - start.x)}px`,
        top: `${Math.max(0, start.rect.top + e.clientY - start.y)}px`,
        right: 'auto', bottom: 'auto',
      });
      const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    });

    const status = text => { root.querySelector('.status').textContent = text; };
    loadSession()
      .then(async session => {
        if (!session.lessons) { // no steps yet: the regional-revenue Guided stub
          status(`Run ${session.run_id} · ${session.title}`);
          root.querySelector('.mode').textContent = 'Guided';
          renderGuidedStub(root, session, status);
          return;
        }
        startLessons(root, session, (await fetchJson('/coach/api/steps', 'steps', status)).lessons, status);
      })
      .catch(error => {
        status('The coach service is unavailable. RStudio still works.');
        note('session_failed', {error: String(error)});
      });
    note('mounted');
  }

  function loadSession() {
    if (coach.session) return Promise.resolve(coach.session);
    const status = text => { const el = coach.host?.shadowRoot?.querySelector('.status'); if (el) el.textContent = text; };
    return fetchJson('/coach/api/session', 'session', status)
      .then(session => { coach.session = session; note('session', session); return session; });
  }
  // The coach's files, fetched again with a growing pause (1 s, doubling to 10 s) after a network
  // error or a server error, which a slow or restarting connection gives. A 4xx means the run has
  // no such file, so that fails at once. "no-cache" asks the gateway whether the file changed,
  // so a reload gets a short "not modified" instead of the whole file again.
  async function fetchJson(url, label, status) {
    for (let attempt = 1, pause = 1000; ; attempt += 1, pause = Math.min(pause * 2, 10000)) {
      let res = null;
      try { res = await fetch(url, {cache: 'no-cache'}); } catch (error) { note('fetch_retry', {url, error: String(error)}); }
      if (res?.ok) return res.json();
      if (res && res.status < 500) throw new Error(`${label} ${res.status}`);
      status(`Loading the lessons. The connection is slow, so the coach is trying again (try ${attempt + 1})…`);
      await sleep(pause);
    }
  }

  // Dock into RStudio's sidebar when it is shown; float otherwise. Hiding the sidebar
  // removes that pane's DOM, the coach included; re-attach the same element (not a new
  // mount) so typed text and a running demonstration survive.
  function place() {
    const host = coach.host;
    if (!host) return;
    const sidebar = ide.sidebar();
    const want = sidebar ? 'docked' : 'floating';
    const parent = sidebar || document.body;
    if (host.parentElement !== parent) parent.appendChild(host);
    if (host.dataset.placement !== want) {
      host.dataset.placement = want;
      coach.placement = want;
      if (want === 'docked') {
        // Drag position and collapse only apply while floating.
        const panel = host.shadowRoot.querySelector('.panel');
        panel.classList.remove('collapsed');
        for (const side of ['left', 'top', 'right', 'bottom']) panel.style[side] = '';
      }
      note('placement', {placement: want});
    }
  }

  // ---------- Guided stub (regional-revenue: no steps yet, grading not built) ----------
  function renderGuidedStub(root, session, status) {
    const content = root.querySelector('.content');
    content.innerHTML = `
      <ol class="goals">
        <li data-goal="project">Open the ${escapeHtml(session.title)} project</li>
        <li data-goal="script">Open <code>analysis.R</code> in the Source pane</li>
        <li data-goal="console">Read <code>data/orders.csv</code> in the Console</li>
      </ol>
      <label>Your conclusion
        <textarea class="answer" placeholder="Which region leads, and why do the exclusions matter?"></textarea>
      </label>
      <div class="row">
        <button class="primary check">Check work</button>
        <button class="show-console">Show me the Console</button>
        <button class="stop">Stop</button>
      </div>`;
    const $ = sel => content.querySelector(sel);
    $('.check').addEventListener('click', async () => {
      note('check_requested');
      status('Checking…');
      try {
        const res = await fetch('/coach/api/check', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({answer: $('.answer').value})});
        const body = await res.json();
        status(body.message);
        note('check_response', {status: body.status});
      } catch (error) {
        status('The coach service did not answer.');
        note('check_failed', {error: String(error)});
      }
    });
    $('.show-console').addEventListener('click', () => {
      // Instruction first; the highlight attaches if the pane exists.
      status('The Console is where R runs your code. Type read.csv("data/orders.csv") there.');
      const attached = highlight(ide.console(), 6000);
      note('highlight', {target: 'console', attached});
    });
    $('.stop').addEventListener('click', () => {
      note('stop');
      clearHighlight();
      content.replaceChildren(Object.assign(document.createElement('p'), {className: 'ended', textContent: 'This practice run has ended. RStudio stays open, but the coach is no longer tracking it.'}));
    });
    const observe = () => {
      const tabs = [...document.querySelectorAll('[role="tab"]')].map(el => el.textContent.trim());
      const done = {
        project: document.title.includes(session.scenario),
        script: tabs.some(t => t.startsWith('analysis.R')),
      };
      for (const li of content.querySelectorAll('li[data-goal]')) if (done[li.dataset.goal]) li.classList.add('done');
    };
    onIdeChange(observe);
    observe();
  }

  // ---------- Lessons: one set of steps, three modes ----------
  // A mode changes who works RStudio and when results are disclosed, never the steps, the
  // script or the reference output. The learner picks one first and can change it at any time.
  const MODES = {
    demonstration: {label: 'Demonstration', icon: '▶', what: 'Watch the coach write and run the code, and explain it.'},
    guided: {label: 'Guided', icon: '✎', what: 'Do it yourself, one step at a time, with checks and hints.'},
    solo: {label: 'Solo', icon: '◎', what: 'Do the whole task list alone, then check your work.'},
  };
  // Under the lessons, while none is chosen: the modes come next.
  const THEN_MODE = 'Then choose how to work: watch a <strong>Demonstration</strong>, be <strong>Guided</strong> step by step, or work <strong>Solo</strong>.';

  // Several lessons can share a run (one RStudio project). The picker then offers the lessons
  // first, as compact cards with none chosen, and the modes of the chosen one below them. The
  // chosen lesson, its mode and the mode's progress are kept per run in sessionStorage, so a
  // reload returns to them as they were. Choosing a mode starts it afresh (see freshStart), and forgets every
  // other mode's progress, which no longer matches the script or R. Back on the picker returns
  // to the mode just left, as it was.
  //
  // The lessons modelled on R for Data Science (those with a part) are too many for cards. A new
  // tab opens on the lessons in their six parts, none chosen, with the part of the first lesson
  // not yet finished expanded; each lesson is ticked once any mode of it is finished. Once a
  // lesson is chosen, the picker shows it on one line above the mode cards, and Change opens the
  // lessons again. A finished lesson offers the next. Which lessons and modes are finished is
  // kept per run in localStorage.
  function startLessons(root, session, lessons, status) {
    const content = root.querySelector('.content');
    const read = key => { try { return sessionStorage.getItem(key); } catch (_error) { return null; } }; // storage blocked
    const write = (key, value) => {
      try { if (value) sessionStorage.setItem(key, value); else sessionStorage.removeItem(key); } catch (_error) { /* storage blocked */ }
    };
    const lessonKey = `rsCoachLesson:${session.run_id}`;
    const pendingKey = `rsCoachPending:${session.run_id}`; // {lesson, mode, autostart, tries}: a start that reloads first
    const modeKey = l => `rsCoachMode:${session.run_id}:${l.id}`;
    const forgetProgress = () => {
      const progress = new RegExp(`^rsCoach(?:Mode|Demo|Guided|Solo):${session.run_id}:`);
      try { for (const key of Object.keys(sessionStorage)) if (progress.test(key)) sessionStorage.removeItem(key); } catch (_error) { /* storage blocked */ }
    };
    const modesOf = l => l.modes.filter(mode => mode in MODES);
    const switchLabel = lessons.length > 1 ? 'Change lesson or mode' : 'Change mode';
    const setHeader = text => { root.querySelector('.mode').textContent = text; };
    const local = {
      read: key => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (_error) { return null; } },
      write: (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch (_error) { /* storage blocked */ } },
    };
    const finishedKey = `rsCoachFinished:${session.run_id}`; // {lesson id: [modes finished]}
    const inRKey = `rsCoachInR:${session.run_id}`; // the lesson whose code R last ran
    const finished = () => local.read(finishedKey) || {};
    const collection = lessons.length > 1 && lessons.every(l => l.part);
    const firstUnfinished = () => lessons.find(l => !finished()[l.id]?.length) || lessons[0];
    // null until the learner chooses one, when the run has several.
    let lesson = lessons.find(l => l.id === read(lessonKey)) || (lessons.length === 1 ? lessons[0] : null);
    const nextAfter = l => {
      const next = collection ? lessons[lessons.indexOf(l) + 1] : null;
      return next && {label: `Next: lesson ${next.number} · ${next.title}`, go: () => { resume = null; lesson = next; open(null); }};
    };
    let teardown = () => {};
    let resume = null; // {lesson, mode}: what Back on the picker returns to
    const leave = () => { teardown(); teardown = () => {}; };

    // A mode as it stands: reopened after a reload or by Back, or just reset by start().
    function open(mode, {restored = false, autostart = false} = {}) {
      leave();
      Object.assign(coach, {mode, lesson: lesson?.id ?? null});
      setHeader(mode ? MODES[mode].label : lessons.length > 1 ? 'Choose a lesson and mode' : 'Choose a mode');
      write(lessonKey, lesson?.id);
      if (lesson) write(modeKey(lesson), mode);
      status(`Run ${session.run_id} · ${mode ? lesson.title : `${lessons.length} lesson${lessons.length > 1 ? 's' : ''}`}`);
      note('mode', {lesson: lesson?.id ?? null, mode, restored});
      content.replaceChildren();
      if (!mode) { renderPicker(); return; }
      const render = {demonstration: renderDemo, guided: renderGuided, solo: renderSolo}[mode];
      const storeKey = name => `rsCoach${name}:${session.run_id}:${lesson.id}`;
      // Back on the picker can return to this mode, unless the learner ended it (Stop).
      const changeMode = (resumable = true) => {
        resume = resumable ? {lesson, mode} : null;
        open(null);
      };
      const done = lesson;
      const finish = () => {
        const record = finished();
        record[done.id] = [...new Set([...(record[done.id] || []), mode])];
        local.write(finishedKey, record);
        note('lesson_finished', {lesson: done.id, mode});
      };
      teardown = render({content, session, lesson, status, restored, autostart, storeKey, switchLabel, changeMode,
        startOver: () => start(mode, {autostart: true}), finish, next: nextAfter(lesson)}) || teardown;
      if (mode !== 'demonstration' && !restored && !autostart) showStartOverview(content, lesson, mode, changeMode, switchLabel);
    }

    // A mode chosen on the picker, or Start over: reset RStudio, then open the mode from scratch.
    // The panel says what is happening and offers nothing to press until RStudio is ready.
    async function start(mode, {autostart = false, tries = 0} = {}) {
      leave();
      resume = null;
      forgetProgress();
      Object.assign(coach, {mode, lesson: lesson.id});
      setHeader(MODES[mode].label);
      status(`Run ${session.run_id} · ${lesson.title}`);
      // A different lesson from the one R last ran gets a new R session (see freshStart).
      const was = lessons.find(l => l.id === local.read(inRKey));
      const restart = Boolean(was) && was !== lesson && (was.version === 2 || lesson.version === 2);
      content.innerHTML = `
        <h2>${escapeHtml(lesson.title)}</h2>
        <section class="card starting">
          <h3>${autostart ? 'Starting over' : `Starting ${MODES[mode].label}`}</h3>
          <p class="phase">Starting from the beginning: <code>${escapeHtml(lesson.script)}</code> goes back to its step headings, ${restart ? 'R restarts, ' : ''}and the Console, Environment and Plots are cleared.</p>
          <div class="timer working"><span></span></div>
        </section>`;
      const phase = content.querySelector('.starting .phase');
      // A lesson can leave RStudio in a project of the learner's own (lesson 6's new project), but
      // the lessons' scripts and data are in the run's project. Going back there reloads the page,
      // so the start is recorded first and carried on after the reload (twice at most).
      const wrongProject = [];
      // Carried on after the reload into the lessons' project: the coach loads before RStudio does,
      // so wait for the IDE, and for R's evidence to come from the reopened project.
      if (tries > 0) {
        phase.textContent = `RStudio is reopening the lessons' project, ${session.project}. The lesson starts when it's ready.`;
        await waitFor(() => byId('rstudio_console_input') && ide.menubar('File') && (ide.files() || ide.filesTab()), 120000);
        for (const t = Date.now(); Date.now() - t < 60000; await sleep(500)) {
          if (((await readEvidence(0)).state?.wd || '').split('/').pop() === session.project) break;
        }
        await sleep(1000);
      }
      const here = ((await readEvidence(0)).state?.wd || '').split('/').pop();
      if (session.project && here && here !== session.project) {
        if (tries < 2) {
          phase.textContent = `RStudio is in the project ${here}. The coach takes it back to the lessons' project, ${session.project}, which reloads the page. The lesson then starts.`;
          write(pendingKey, JSON.stringify({lesson: lesson.id, mode, autostart, tries: tries + 1}));
          try {
            await openProject(session.project, text => { phase.textContent = text; });
          } catch (error) {
            write(pendingKey, null);
            wrongProject.push(error.message);
          }
        } else {
          wrongProject.push(`RStudio is still in the project ${here}. Choose ${session.project} from the project menu at the top right of RStudio, then choose a mode again.`);
        }
      }
      const problems = [...wrongProject, ...await freshStart(lesson, {restart, slow: () => {
        phase.textContent = 'R is restarting. Just after RStudio starts, this can take up to 30 seconds.';
      }})];
      local.write(inRKey, lesson.id);
      open(mode, {autostart});
      if (problems.length) {
        const warning = Object.assign(document.createElement('p'), {className: 'error reset-problem'});
        warning.textContent = `The coach couldn't reset everything. ${problems.join(' ')}`;
        content.prepend(warning);
      }
    }

    function renderPicker() {
      if (collection) { renderCollectionPicker(); return; }
      const modes = lesson ? modesOf(lesson) : [];
      const lessonCards = `
        <div class="pick" role="radiogroup" aria-labelledby="lesson-label">
          <p class="pick-label" id="lesson-label">Choose a lesson</p>
          ${lessons.map(l => `
            <button class="lesson-card" role="radio" aria-checked="${l === lesson}" data-lesson="${escapeHtml(l.id)}">
              <span class="dot" aria-hidden="true"></span>
              <strong>${escapeHtml(l.title)}</strong>
              <span class="what">${escapeHtml(covers(l))}</span>
            </button>`).join('')}
        </div>`;
      content.innerHTML = `
        ${lessons.length > 1 ? lessonCards : `<h2>${escapeHtml(lesson.title)}</h2><div class="prose">${format(lesson.summary, {})}</div>`}
        ${lesson ? `
        <div class="pick" role="group" aria-labelledby="pick-label">
          <p class="pick-label" id="pick-label">How do you want to work?</p>
          ${modes.map(mode => `
            <button class="mode-card" data-mode="${mode}">
              <span class="icon" aria-hidden="true">${MODES[mode].icon}</span>
              <strong>${MODES[mode].label}</strong>
              <span class="what">${escapeHtml(MODES[mode].what)}</span>
            </button>`).join('')}
        </div>` : `<p class="muted then">${THEN_MODE}</p>`}
        ${resume ? `<div class="row"><button class="back">Back to ${escapeHtml(MODES[resume.mode].label)}${lessons.length > 1 ? `: ${escapeHtml(resume.lesson.title)}` : ''}</button></div>` : ''}
        <p class="muted">You can change the ${lessons.length > 1 ? 'lesson or ' : ''}mode at any time. Each choice starts the lesson from the start, with a clean script and R.</p>`;
      for (const card of content.querySelectorAll('.lesson-card')) {
        card.addEventListener('click', () => {
          lesson = lessons.find(l => l.id === card.dataset.lesson);
          write(lessonKey, lesson.id);
          Object.assign(coach, {lesson: lesson.id});
          note('lesson', {lesson: lesson.id});
          renderPicker();
          content.querySelector(`.lesson-card[data-lesson="${CSS.escape(lesson.id)}"]`)?.focus();
        });
      }
      for (const card of content.querySelectorAll('.mode-card')) card.addEventListener('click', () => start(card.dataset.mode));
      content.querySelector('.back')?.addEventListener('click', () => {
        const {lesson: was, mode} = resume;
        resume = null;
        lesson = was;
        open(mode, {restored: true});
      });
    }
    // The chosen lesson on one line, the lessons by part behind Change, then the mode cards.
    // Until a lesson is chosen, only the lessons by part, with no mode cards.
    function renderCollectionPicker(listOpen = false) {
      const done = finished();
      const parts = [...new Set(lessons.map(l => l.part))].map(title => ({title, lessons: lessons.filter(l => l.part === title)}));
      const tick = l => (done[l.id]?.length ? `<span class="tick" title="Finished: ${done[l.id].map(m => MODES[m].label).join(', ')}">✓</span>` : '');
      const expanded = lesson || firstUnfinished(); // whose part starts open
      const list = `
        <nav class="lesson-list" id="lesson-list" ${lesson ? 'aria-label="Lessons"' : 'aria-labelledby="lesson-label"'} ${lesson && !listOpen ? 'hidden' : ''}>
          ${parts.map(part => `
            <details ${part.lessons.includes(expanded) ? 'open' : ''}>
              <summary>${escapeHtml(part.title)}</summary>
              <ul>${part.lessons.map(l => `
                <li><button class="lesson-pick" data-lesson="${escapeHtml(l.id)}" aria-current="${l === lesson}">
                  <span class="num">${l.number}</span><span class="name">${escapeHtml(l.title)}</span>
                  <span class="what">${l.steps.length} steps</span>${tick(l)}</button></li>`).join('')}
              </ul>
            </details>`).join('')}
        </nav>`;
      if (!lesson) {
        content.innerHTML = `
          <p class="pick-label" id="lesson-label">Choose a lesson</p>
          ${list}
          <p class="muted then">${THEN_MODE}</p>`;
        bindLessonPicks();
        return;
      }
      const modes = modesOf(lesson);
      content.innerHTML = `
        <div class="lesson-row">
          <p><span class="muted">Lesson ${lesson.number} · ${escapeHtml(lesson.part)}</span><br><strong class="lesson-title">${escapeHtml(lesson.title)}</strong></p>
          <button class="link change" aria-expanded="${listOpen}" aria-controls="lesson-list">${listOpen ? 'Close' : 'Change'}</button>
        </div>
        ${list}
        <div class="lesson-summary prose">${format(lesson.summary, {})}</div>
        <div class="pick" role="group" aria-labelledby="pick-label">
          <p class="pick-label" id="pick-label">How do you want to work?</p>
          ${modes.map(mode => `
            <button class="mode-card" data-mode="${mode}">
              <span class="icon" aria-hidden="true">${MODES[mode].icon}</span>
              <strong>${MODES[mode].label}${done[lesson.id]?.includes(mode) ? ' <span class="done-mark">✓ done</span>' : ''}</strong>
              <span class="what">${escapeHtml(MODES[mode].what)}</span>
            </button>`).join('')}
        </div>
        ${resume ? `<div class="row"><button class="back">Back to ${escapeHtml(MODES[resume.mode].label)}: ${escapeHtml(resume.lesson.title)}</button></div>` : ''}
        <p class="muted">Each choice starts the lesson from the start, with a clean script and R.${lesson.chapter
          ? ` To go deeper, read <a href="${escapeHtml(lesson.chapter)}" target="_blank" rel="noopener">this topic in R for Data Science</a>.` : ''}</p>`;
      content.querySelector('.change').addEventListener('click', () => {
        renderCollectionPicker(!listOpen);
        content.querySelector(listOpen ? '.change' : '.lesson-pick[aria-current="true"]')?.focus();
      });
      bindLessonPicks();
      for (const card of content.querySelectorAll('.mode-card')) card.addEventListener('click', () => start(card.dataset.mode));
      content.querySelector('.back')?.addEventListener('click', () => {
        const {lesson: was, mode} = resume;
        resume = null;
        lesson = was;
        open(mode, {restored: true});
      });
    }
    // Choosing a lesson in the list closes it and offers that lesson's modes.
    function bindLessonPicks() {
      for (const pick of content.querySelectorAll('.lesson-pick')) {
        pick.addEventListener('click', () => {
          lesson = lessons.find(l => l.id === pick.dataset.lesson);
          write(lessonKey, lesson.id);
          Object.assign(coach, {lesson: lesson.id});
          note('lesson', {lesson: lesson.id});
          renderCollectionPicker(false);
          content.querySelector('.mode-card')?.focus();
        });
      }
    }
    // What a lesson covers, from its step titles: "Plots: plot()" -> "plot()".
    function covers(l) {
      return `${l.steps.length} steps: ${l.steps.map(s => s.title.split(': ').pop()).join(', ')}`;
    }
    // A reload returns to the lesson and mode as they were; a new run (or tab) opens on the picker,
    // with no lesson chosen if there are several, or straight into the only mode of a one-lesson,
    // one-mode run, as provisioned.
    const pending = (() => { try { return JSON.parse(read(pendingKey) || 'null'); } catch (_error) { return null; } })();
    if (pending && lessons.some(l => l.id === pending.lesson) && pending.mode in MODES) {
      write(pendingKey, null);
      lesson = lessons.find(l => l.id === pending.lesson);
      start(pending.mode, {autostart: pending.autostart, tries: pending.tries});
      return;
    }
    const saved = lesson && read(modeKey(lesson));
    const modes = lesson ? modesOf(lesson) : [];
    open(modes.includes(saved) ? saved : modes.length === 1 && lessons.length === 1 ? modes[0] : null, {restored: modes.includes(saved)});
  }

  // The card's "now" line: what the coach is doing in RStudio, in plain words. Each change
  // fades in, so the eye notices that the coach has moved on.
  const phaseSetter = el => text => {
    el.innerHTML = text ? inline(text) : '';
    el.classList.remove('new');
    if (text) { void el.offsetWidth; el.classList.add('new'); }
  };
  // A mode's introduction: the lesson's title and how this mode works. What the lesson covers was
  // on the picker just before, so it isn't repeated here; the steps say it instead.
  const lessonHeader = (lesson, howto) => `
    <h2>${escapeHtml(lesson.title)}</h2>
    <p class="howto">${inline(howto)}</p>`;
  // Guided and Solo show a brief before the task list: the mode, the script and the steps, open.
  // The learner can reopen it later.
  function showStartOverview(content, lesson, mode, changeMode, switchLabel) {
    const work = document.createElement('div');
    work.className = 'lesson-work';
    work.hidden = true;
    while (content.firstChild) work.append(content.firstChild);
    const preview = document.createElement('section');
    preview.className = 'lesson-preview';
    preview.innerHTML = `
      <h2>${escapeHtml(lesson.title)}</h2>
      <p>${escapeHtml(MODES[mode].what)}</p>
      <p class="muted">You'll work in <code>${escapeHtml(lesson.script)}</code>.</p>
      ${stepsBox(lesson.steps, true, false)}
      <div class="row"><button class="primary begin">Start ${escapeHtml(MODES[mode].label)}</button><button class="preview-switch">${switchLabel}</button></div>
      ${sourceLine(lesson)}`;
    content.append(preview, work);
    const reopen = document.createElement('div');
    reopen.className = 'row';
    reopen.innerHTML = '<button class="link reopen-overview">Lesson overview</button>';
    work.append(reopen);
    const showWork = () => {
      preview.hidden = true;
      work.hidden = false;
      (work.querySelector('.card h3, .solo-steps') || work.querySelector('button')).setAttribute('tabindex', '-1');
      (work.querySelector('.card h3, .solo-steps') || work.querySelector('button')).focus();
    };
    preview.querySelector('.begin').addEventListener('click', showWork);
    preview.querySelector('.preview-switch').addEventListener('click', () => changeMode(false));
    reopen.querySelector('button').addEventListener('click', () => {
      work.hidden = true;
      preview.hidden = false;
      preview.querySelector('.begin').focus();
    });
  }
  const sourceLine = lesson => (lesson.chapter
    ? `<p class="muted source">To go deeper, read <a href="${escapeHtml(lesson.chapter)}" target="_blank" rel="noopener">this topic in R for Data Science</a>.</p>`
    : `<p class="muted source">${escapeHtml(lesson.source)}</p>`);
  // What the lesson's checklist counts: lines in the older lessons; tasks (statements and IDE
  // actions) in those modelled on the book.
  const unitOf = lesson => (lesson.version === 2 ? 'task' : 'line');
  // `tracked`: the mode marks each step done or current (data-step). An overview's list is only read.
  const stepList = (steps, tracked = true) => `<ol class="steps">${steps.map((s, i) => `<li${tracked ? ` data-step="${i}"` : ''}>${linkedTitle(s.title)}</li>`).join('')}</ol>`;
  const stepsBox = (steps, open = false, tracked = true) => `<details class="steps-box"${open ? ' open' : ''}><summary>The ${steps.length} steps</summary>${stepList(steps, tracked)}</details>`;
  // R's message after library(tidyverse) ends with red "Conflicts" lines that look like errors.
  const attachesTidyverse = run => run.evidence === 'attached' && /^tidyverse$/.test(run.expected?.library || '');
  const conflictsNote = () => `<p class="note"><strong>Red ✖ lines under “Conflicts”?</strong> They are normal, not errors. They say that two tidyverse functions, <code>${functionLink('filter')}()</code> and <code>${functionLink('lag')}()</code>, are used instead of base R functions with the same names. You can ignore them.</p>`;
  const CONFLICTS_NOTE_SHORT = '<p class="note">If red ✖ lines under “Conflicts” appear after this, they are normal, not errors. You can ignore them.</p>';
  // When the tidyverse was attached already (by an earlier mode: a fresh start empties the
  // Environment but keeps R's session), library() prints nothing, and the note above would puzzle.
  const ALREADY_LOADED_NOTE = '<p class="note"><strong>Nothing printed?</strong> The tidyverse was already loaded in this R session, so R had nothing new to say. In a new session, R lists its packages, then some red “Conflicts” lines, which are normal.</p>';
  // Whether R's message after library(tidyverse) was shown: its Conflicts lines, or nothing at all.
  // null when the coach can't tell.
  const showedConflicts = output => (typeof output !== 'string' ? null : /Conflicts|Attaching core tidyverse/.test(output) ? true : output.trim() ? null : false);
  const PLOT_HISTORY_NOTE = '<p class="note"><strong>Where will the earlier chart go?</strong> When you run this chart, the newest chart appears in Plots. The earlier chart stays in this session\'s plot history. Use the left and right arrows above Plots to move between charts. Its code stays in the script, so you can run it again. <a href="https://docs.posit.co/ide/user/ide/guide/ui/ui-panes.html#plots-pane" target="_blank" rel="noopener">About the Plots pane</a>.</p>';
  const drawsChart = run => ['plot', 'ggplot'].includes(run.evidence);
  function firstReplacementChart(lesson) {
    let sawChart = false;
    for (const [s, step] of lesson.steps.entries()) {
      for (const [r, run] of step.runs.entries()) {
        if (!drawsChart(run)) continue;
        if (sawChart) return {s, r};
        sawChart = true;
      }
    }
    return null;
  }
  const chartTaskNote = (lesson, s, r) => {
    const first = firstReplacementChart(lesson);
    return first && first.s === s && first.r === r ? PLOT_HISTORY_NOTE : '';
  };
  // `conflicts`: whether the Console showed the tidyverse's message (see showedConflicts).
  const stepNotes = (step, conflicts = null) => (!step.runs.some(attachesTidyverse) ? ''
    : conflicts === false ? ALREADY_LOADED_NOTE : conflictsNote());
  // A step's explanation, with any note about what RStudio showed.
  const explainHtml = (step, values, conflicts = null) => format(step.explain, values) + stepNotes(step, conflicts);
  function endedView(content, text, changeMode, switchLabel) {
    content.innerHTML = `<p class="ended"></p><div class="row"><button class="switch">${switchLabel}</button></div>`;
    content.querySelector('.ended').textContent = text;
    content.querySelector('.switch').addEventListener('click', () => changeMode(false)); // nothing to go back to
  }

  // ---------- A fresh start ----------
  // Choosing a mode, or Start over, starts the lesson from scratch, whatever ran before it in
  // RStudio. Otherwise a Demonstration's code would already be under the headings when Guided asks
  // the learner to write it, and its chart and variables would already be on screen. The lesson's
  // script goes back to the step headings it was provisioned with. Then the coach empties R the
  // way a learner would, with the brooms on the Environment and Plots panes (each confirmed in
  // RStudio's own dialog, and only if there is something to clear), and clears the Console. This
  // is housekeeping rather than part of the lesson, so the coach works RStudio without its pointer.
  // Resolves to the problems it met, for the panel to report.
  //
  // Restart R only when the lesson changes to or from one modelled on the book (version 2): those
  // attach packages, and some replace other packages' methods (duckplyr's for dplyr), which only a
  // new R session undoes. Staying in a lesson keeps the brooms: in a session's first half-minute
  // RStudio holds a restart back (one asked for 7 s after sign-in took 23.6 s, against 1-2 s later
  // on), and that is when a learner picks their first mode. `slow` says why, if it comes to that.
  async function freshStart(lesson, {restart = false, slow = () => {}} = {}) {
    const began = Date.now();
    const problems = [];
    const attempt = async fn => { try { await fn(); } catch (error) { problems.push(error.message); } };
    let restarted = false;
    if (restart) await attempt(async () => { await restartR(slow); restarted = true; });
    await attempt(() => resetScript(lesson.script, lesson.starter));
    // Documents the lesson's actions open or create are closed, unsaved changes discarded, and so is
    // the Markdown file reprex() opens on a server (lesson 8).
    const runs = lesson.steps.flatMap(step => step.runs);
    const opened = runs.filter(run => run.action === 'open-file' || run.action === 'new-file');
    const patterns = runs.some(run => /\breprex\(/.test(run.code || '')) ? [/_reprex\.md$/] : [];
    for (const run of runs) {
      for (const [, name] of (run.code || '').matchAll(/\bView\(([A-Za-z.][\w.]*)/g)) patterns.push(new RegExp(`^${name.replace(/\./g, '\\.')}$`));
    }
    if (opened.length || patterns.length) await attempt(() => closeDocuments(opened.map(run => run.file).filter(Boolean), patterns));
    // Panes the lesson's checks look at go back to a blank state, or a page left from before would
    // count by itself: Help to its home page, the Viewer emptied.
    const checks = runs.map(run => run.ide).filter(Boolean);
    const helps = checks.filter(c => c.help).map(c => new RegExp(c.help));
    const helpShows = () => helps.some(re => re.test(ide.helpTitle() || ''));
    if (helpShows()) await attempt(() => resetPane('help', 'rstudio_tb_helphome', () => !helpShows()));
    if (checks.some(c => c.viewer) && ide.viewerShows()) await attempt(() => resetPane('viewer', 'rstudio_tb_viewerclearall', () => !ide.viewerShows()));
    // A setting the lesson asks the learner to change goes back to how it was, or that step would
    // count before the learner did anything.
    const settings = lesson.steps.flatMap(step => step.runs).filter(run => run.action === 'option' && run.ide && 'pref' in run.ide);
    if (settings.length) {
      const prefs = (await readEvidence(0)).state?.prefs || {};
      for (const run of settings.filter(r => prefs[r.ide.pref] === r.ide.value)) await attempt(() => setOptionQuietly(run, !run.value));
    }
    const objects = !ide.environmentEmpty();
    if (objects) await attempt(clearObjects);
    const charts = ide.chartShown();
    if (charts) await attempt(clearPlots);
    const clear = ide.consoleClear();
    if (clear) press(clear);
    const cleared = Boolean(await waitFor(() => !ide.consoleText().trim(), 3000));
    const detail = {lesson: lesson.id, at: Date.now(), ms: Date.now() - began, restarted, objects, charts, cleared, problems};
    coach.fresh = {count: coach.fresh.count + 1, last: detail};
    note('fresh_start', detail);
    return problems;
  }

  // Open the project `name` from RStudio's project menu (housekeeping, no pointer). RStudio then
  // reloads the page, so this only returns by throwing. If RStudio first asks about unsaved changes
  // in the learner's own project, the learner answers: `tell` says so.
  async function openProject(name, tell) {
    const button = await waitFor(ide.projectMenu, 5000);
    if (!button) throw new Error(`RStudio's project menu isn't visible, so RStudio is still in another project. Open ${name} with File › Open Project….`);
    press(button);
    const item = await waitFor(() => [...document.querySelectorAll('[role="menu"] [role="menuitem"]')].find(e => shown(e) && e.textContent.trim() === name), 5000);
    if (!item) {
      document.body.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
      throw new Error(`RStudio's project menu doesn't list ${name}. Open it with File › Open Project….`);
    }
    press(item);
    note('open_project', {name});
    for (const t = Date.now(); Date.now() - t < 180000; await sleep(500)) {
      if (ide.dialog(/unsaved changes|Save changes/i)) tell(`RStudio asks what to do with unsaved changes before it leaves this project. Answer it, and the lesson starts once RStudio has reloaded.`);
    }
    throw new Error(`RStudio didn't go back to the project ${name}.`);
  }

  // Session › Restart R, as housekeeping (no pointer). Done once R's evidence comes from a new session.
  async function restartR(slow) {
    // R writes its first evidence a second after it starts: wait for it, to tell the new session apart.
    let before = (await readEvidence(0)).session;
    for (const t = Date.now(); !before && Date.now() - t < 10000;) {
      await sleep(250);
      before = (await readEvidence(0)).session;
    }
    const bar = ide.menubar('Session');
    if (!bar) throw new Error('RStudio\'s Session menu isn\'t visible, so R wasn\'t restarted.');
    press(bar);
    const item = await waitFor(() => ide.menuItem(/^Restart R/), 3000);
    if (!item) throw new Error('The Session menu has no Restart R, so R wasn\'t restarted.');
    press(item);
    const started = Date.now();
    for (;;) {
      const doc = await readEvidence(0);
      if (doc.session && doc.session !== before) break;
      if (slow && Date.now() - started > 4000) { slow(); slow = null; }
      if (Date.now() - started > 60000) throw new Error('R did not restart within a minute, so the last lesson\'s packages may still be attached.');
      await sleep(250);
    }
    note('restart_r', {ms: Date.now() - started});
  }

  // Press a pane's toolbar button (housekeeping, no pointer), showing the pane first if another tab
  // hides it, and confirming if RStudio asks. Done once `cleared` holds.
  async function resetPane(pane, buttonId, cleared) {
    if (!byId(`rstudio_workbench_panel_${pane}`)) {
      const tab = byId(`rstudio_workbench_tab_${pane}`);
      if (tab) press(tab);
      await waitFor(() => byId(`rstudio_workbench_panel_${pane}`), 3000);
    }
    const button = await waitFor(() => byId(buttonId), 3000);
    if (!button) throw new Error(`The coach couldn't reset the ${pane} pane: its toolbar button isn't visible.`);
    press(button);
    const yes = await waitFor(() => { const d = ide.dialog(/clear|remove/i); return d && (ide.dialogButton(d, 'Yes') || ide.dialogButton(d, 'OK')); }, 1500);
    if (yes) press(yes);
    if (!(await waitFor(cleared, 5000))) throw new Error(`The ${pane} pane still shows a page from before.`);
    note('reset_pane', {pane});
  }

  // Close Source tabs for `files`, names matching `patterns` and any untitled document, choosing
  // Don't Save if RStudio asks.
  async function closeDocuments(files, patterns = []) {
    const extra = () => [...document.querySelectorAll('#rstudio_Source_pane [role="tab"]')].find(t => {
      const name = t.textContent.trim().replace(/\*$/, '');
      return shown(t) && (files.includes(name) || /^Untitled\d*$/.test(name) || patterns.some(re => re.test(name)));
    });
    for (let n = 0; n < 10 && extra(); n += 1) {
      const tab = extra();
      const close = tab.querySelector('img[alt="Close document tab"]');
      if (!close) throw new Error(`The coach couldn't close ${tab.textContent.trim()}.`);
      press(close);
      const ask = await waitFor(() => ide.dialog(/Save|save/) && [...ide.dialog(/Save|save/).querySelectorAll('button')].find(b => shown(b) && /^Don.t Save$/.test(b.textContent.trim())), 800);
      if (ask) press(ask);
      await waitFor(() => !tab.isConnected || !shown(tab), 3000);
    }
    if (extra()) throw new Error(`${extra().textContent.trim()} is still open from before.`);
  }

  // Tick or untick a Global Options checkbox (housekeeping, no pointer), then wait for R's evidence
  // to show the preference changed.
  async function setOptionQuietly(run, value) {
    const bar = ide.menubar('Tools');
    if (!bar) throw new Error('RStudio\'s Tools menu isn\'t visible.');
    press(bar);
    const item = await waitFor(() => ide.menuItem(/^Global Options/), 3000);
    if (!item) throw new Error('The Tools menu has no Global Options.');
    press(item);
    const plain = text => text.replace(/\s+/g, ' ').trim().replace(/:$/, '');
    const dialog = () => [...document.querySelectorAll('.gwt-DialogBox, [role="dialog"]')].find(d => shown(d) && ide.dialogButton(d, 'OK') && ide.dialogButton(d, 'Cancel'));
    const label = () => [...(dialog()?.querySelectorAll('label') || [])].find(l => shown(l) && plain(l.textContent) === plain(run.label));
    if (!(await waitFor(dialog, 10000))) throw new Error('Global Options did not open, so a setting from before is still on.');
    if (!label()) {
      const pane = [...dialog().querySelectorAll('*')].find(el => el.childElementCount === 0 && shown(el) && el.textContent.trim() === run.pane);
      if (pane) press(pane);
      await waitFor(label, 5000);
    }
    const box = label() && (label().htmlFor ? document.getElementById(label().htmlFor) : label().parentElement.querySelector('input[type="checkbox"]'));
    if (box && box.checked !== value) box.click();
    press(ide.dialogButton(dialog(), box ? 'OK' : 'Cancel'));
    if (!box) throw new Error(`Global Options has no setting "${run.label}".`);
    for (const t = Date.now(); Date.now() - t < 5000;) {
      if ((await readEvidence(0)).state?.prefs?.[run.ide.pref] === (run.ide.value === run.value ? value : !value)) return;
      await sleep(250);
    }
    throw new Error(`RStudio didn't save "${run.label}".`);
  }

  // `script` back to `text` and saved, with no undo history that could bring the old code back.
  async function resetScript(script, text) {
    const editor = await openQuietly(script);
    if (editor.getValue() !== text) editor.session.getDocument().setValue(text);
    editor.session.getUndoManager().reset();
    editor.clearSelection();
    editor.moveCursorTo(0, 0);
    editor.renderer.scrollToRow(0);
    if (!ide.unsaved(script)) return;
    const save = await waitFor(ide.saveButton, 2000);
    if (save) press(save);
    if (!(await waitFor(() => !ide.unsaved(script), 5000))) throw new Error(`RStudio did not save ${script} after the coach reset it.`);
  }

  // Show `script` in the Source pane: its tab if it is open, otherwise from the project folder in
  // the Files pane. RStudio re-renders the Files list and tab strip, so retry a click that missed.
  async function openQuietly(script) {
    const listed = () => ide.sourceTab(script) || ide.fileLink(script);
    for (let attempt = 1; attempt <= 3 && !ide.scriptEditor(script); attempt += 1) {
      if (!listed()) {
        if (!ide.files() && ide.filesTab()) press(ide.filesTab());
        else if (ide.filesHome()) press(ide.filesHome()); // Files shows another folder
      }
      const target = await waitFor(listed, 5000);
      if (!target) break;
      press(target);
      await waitFor(() => ide.scriptEditor(script), 4000);
    }
    const editor = ide.scriptEditor(script);
    if (!editor) throw new Error(`${script} did not open from the project folder, so it still holds what was typed before.`);
    return editor;
  }

  // Press Yes in RStudio's confirmation dialog titled `title`. Its id differs from dialog to dialog.
  async function confirm(title) {
    const yes = await waitFor(() => {
      const dialog = [...document.querySelectorAll('[role="alertdialog"]')].find(d => shown(d) && d.textContent.includes(title));
      return dialog && [...dialog.querySelectorAll('button')].find(b => shown(b) && b.textContent.trim() === 'Yes');
    }, 3000);
    if (yes) press(yes);
    return Boolean(yes);
  }

  // The Environment pane's broom removes every object, hidden ones included (the dialog's default).
  async function clearObjects() {
    const broom = document.getElementById('rstudio_tb_clearworkspace');
    if (broom) press(broom);
    if (!broom || !(await confirm('Remove Objects')) || !(await waitFor(ide.environmentEmpty, 5000))) {
      throw new Error('The objects from before are still in the Environment pane.');
    }
  }

  // The Plots pane's broom does nothing unless the Plots tab is showing.
  async function clearPlots() {
    if (!ide.plots() && ide.plotsTab()) press(ide.plotsTab());
    const broom = await waitFor(() => byId('rstudio_tb_clearplots'), 2000);
    if (broom) press(broom);
    if (!broom || !(await confirm('Clear Plots')) || !(await waitFor(() => !ide.chartShown(), 5000))) {
      throw new Error('The chart from before is still in the Plots pane.');
    }
  }

  // ---------- Evidence from R ----------
  // runtime/evidence.R records, in R, what every top-level call returned: a fingerprint of the
  // value, the name it assigned and the package a library() call named. It also records a little
  // IDE state: attached packages, RStudio preferences, the project's files and when each changed.
  // The gateway serves it to a browser signed in to RStudio. Lessons with "version": 2 are checked
  // against it, so a statement counts whichever way the learner writes it, and a tibble counts
  // however narrow the Console that printed it. Older lessons are checked by what the Console shows.
  const evidence = {doc: null, at: 0, pending: null, failures: 0, tookMs: 0};
  const EMPTY_EVIDENCE = {session: null, seq: 0, calls: [], state: null};
  // On a slow connection a fetch takes longer, and the next one waits as long again, so polling
  // never takes more than half of a slow connection's time.
  function readEvidence(maxAgeMs = 250) {
    if (evidence.pending) return evidence.pending;
    const age = Math.min(Math.max(maxAgeMs, maxAgeMs && evidence.tookMs), 5000);
    if (evidence.doc && Date.now() - evidence.at < age) return Promise.resolve(evidence.doc);
    const began = Date.now();
    // A connection that stalls can hold a request for minutes: give up after 20 s and ask again.
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 20000);
    evidence.pending = fetch('/coach/api/evidence', {cache: 'no-store', signal: abort.signal})
      .then(res => {
        if (res.status === 404) return EMPTY_EVIDENCE; // R hasn't written any yet
        if (!res.ok) throw new Error(`evidence ${res.status}`);
        return res.json();
      })
      .then(doc => {
        Object.assign(evidence, {doc, at: Date.now(), tookMs: Date.now() - began});
        net.lastAnswer = Date.now();
        return doc;
      })
      .catch(error => {
        evidence.failures += 1;
        note('evidence_failed', {error: String(error)});
        return evidence.doc || EMPTY_EVIDENCE;
      })
      .finally(() => { clearTimeout(timer); evidence.pending = null; });
    return evidence.pending;
  }
  // R's record as last read, asking for a newer one meanwhile: for loops that keep their own time
  // and messages, which a fetch held up by the connection mustn't hold up.
  const latestEvidence = () => { readEvidence(); return evidence.doc || EMPTY_EVIDENCE; };
  // Where a mode's work starts: R's session and its last call, and each project file's modification
  // time. Only calls after the mark count, and a file counts once it changes.
  async function evidenceMark() {
    const doc = await readEvidence(0);
    return {session: doc.session, seq: doc.seq || 0, at: Date.now(),
      files: Object.fromEntries((doc.state?.files || []).map(f => [f.path, f.mtime]))};
  }
  // The same, saying why the coach is waiting if the connection holds the reading up for more than
  // 2 s, then putting back what the panel said (`said`).
  async function patientMark(setPhase, said) {
    let waited = false;
    const timer = setTimeout(() => { waited = true; setPhase('Waiting for RStudio to answer. The connection may be slow…'); }, 2000);
    try {
      return await evidenceMark();
    } finally {
      clearTimeout(timer);
      if (waited && said) setPhase(said);
    }
  }
  const callKey = (doc, call) => `${doc.session}:${call.seq}`;
  const usesEvidence = run => !['console', 'plot', 'pattern', 'error'].includes(run.evidence);
  // Whether `run` is done since `mark`, by R's evidence. A call counts for one statement only, so
  // printing `trips` doesn't also tick the step that read it in: `claimed` holds the calls already
  // used. IDE state counts only once it has been seen not to hold since the mark (`off` records
  // that), so a setting or an editor already as the step wants it doesn't tick by itself;
  // Demonstration, which does the action itself, passes no `off`. Returns {key} or null.
  function evidenceMatch(run, doc, mark, claimed = new Set(), off = null) {
    const want = run.expected || {};
    const fresh = (doc.calls || []).filter(c => doc.session !== mark.session || c.seq > mark.seq).reverse(); // newest first
    const take = test => {
      const call = fresh.find(c => !claimed.has(callKey(doc, c)) && test(c));
      return call ? {key: callKey(doc, call), call} : null;
    };
    switch (run.evidence) {
      case 'value':
        return take(c => (run.order === 'any' ? Boolean(want.fp_any) && c.fp_any === want.fp_any : Boolean(want.fp) && c.fp === want.fp));
      case 'assign':
        return take(c => c.assigned === want.assigned && c.fp === want.fp);
      case 'ggplot':
        return take(c => c.visible && c.fp === want.fp);
      case 'attached':
        return (doc.state?.attached || []).includes(want.library) ? take(c => c.library === want.library) : null;
      case 'file': {
        const file = (doc.state?.files || []).find(f => f.path === run.path && f.mtime !== mark.files?.[run.path]);
        const key = file && `file:${run.path}:${file.mtime}`;
        return key && !claimed.has(key) ? {key} : null; // each version of the file counts once
      }
      case 'ide': {
        const id = `ide:${JSON.stringify(run.ide)}`;
        if (!ideHolds(run.ide, doc, mark)) {
          if (off) off[id] = true;
          return null;
        }
        const relative = run.ide.restarted || run.ide.chord; // measured from the mark already
        return !off || relative || off[id] ? {key: `${id}:${doc.session}`} : null;
      }
      default:
        return null;
    }
  }
  // Record, for every IDE-state task in `lesson`, that its state doesn't hold now (see evidenceMatch).
  // Done when a mode begins and at every check, so a task whose step isn't current yet still sees
  // the state before the learner changes it.
  function noteIdeOff(lesson, doc, mark, off) {
    for (const run of lesson.steps.flatMap(step => step.runs)) {
      if (run.evidence === 'ide' && !ideHolds(run.ide, doc, mark)) off[`ide:${JSON.stringify(run.ide)}`] = true;
    }
  }
  // IDE state a step asks for: a preference's value, R restarted, a tab, the Viewer, Help, the
  // project, a shortcut pressed, the editor's mode.
  function ideHolds(want, doc, mark) {
    if (!want) return false;
    const checks = [];
    if ('pref' in want) checks.push(doc.state?.prefs?.[want.pref] === want.value);
    if (want.restarted) checks.push(Boolean(doc.session) && doc.session !== mark.session);
    // A tab's name without its unsaved marker (always in the markup, hidden by CSS when saved).
    if (want.tab) checks.push(Boolean([...document.querySelectorAll('#rstudio_Source_pane [role="tab"]')].find(t => shown(t) && new RegExp(want.tab).test(t.innerText.trim().replace(/\s*\*$/, '')))));
    if (want.viewer) checks.push(ide.viewerShows());
    if (want.help) checks.push(new RegExp(want.help).test(ide.helpTitle() || ''));
    if (want.project) checks.push(new RegExp(want.project).test((doc.state?.wd || '').split('/').pop()));
    if (want.chord) checks.push(pressedSince(want.chord, mark));
    if (want.editor_mode) checks.push(want.editor_mode === 'visual' ? Boolean(ide.visualEditor()) : Boolean(ide.activeEditor()) && !ide.visualEditor());
    if ('editor_text' in want) checks.push(ide.activeEditor()?.getValue() === want.editor_text);
    if (want.editor_match) checks.push(new RegExp(want.editor_match, 'm').test(ide.activeEditor()?.getValue() ?? ''));
    return checks.length > 0 && checks.every(Boolean);
  }
  // Console-side evidence for "pattern" (today(), timings) and "error" (a statement meant to fail):
  // the newest Console entry from `from` on that shows it and no other statement has used.
  function consoleMatch(run, view, claimed = new Set(), from = view.from) {
    for (let k = view.entries.length - 1; k >= from; k -= 1) {
      const entry = view.entries[k];
      if (!codeKey(entry.code) || claimed.has(`console:${k}`)) continue;
      const error = consoleError(entry.output);
      if (run.evidence === 'error' ? error && new RegExp(run.error).test(error) : !error && new RegExp(run.pattern).test(entry.output.trim())) {
        return {index: k, output: entry.output, key: `console:${k}`};
      }
    }
    return null;
  }

  // The shortcuts a statement can teach (`keys`), and what each one types.
  const SHORTCUTS = {
    'Ctrl+Shift+M': {token: '|>', name: 'the pipe'},
    'Alt+-': {token: '<-', name: 'the assignment arrow'},
  };

  // Whether `run` is done, by the evidence its kind uses: R's record, the Console, or RStudio itself.
  // Returns {key, output} or null. Older lessons' "console" and "plot" lines are matched as before.
  // A statement with `keys` (Ctrl+Shift+M to type |>, Alt+- to type <-) also needs the shortcut
  // pressed since the mode began; `run.keysMissing` says when R's result is right but the shortcut hasn't been used, so
  // Guided can say so. Demonstration presses it while typing, and checks R's evidence alone.
  function runDone(run, view, doc, mark, claimed, off = {}) {
    let match;
    if (run.action || usesEvidence(run)) match = doc && mark ? evidenceMatch(run, doc, mark, claimed, off) : null;
    else if (run.evidence === 'pattern' || run.evidence === 'error') match = consoleMatch(run, view, claimed);
    else {
      match = matchRun(run, view);
      match = match && {...match, key: `console:${match.index}`};
    }
    if (run.code && run.keys) {
      run.keysMissing = Boolean(match) && !pressedSince(run.keys, mark);
      if (run.keysMissing) return null;
    }
    return match;
  }
  const pressedSince = (chord, mark) => Boolean(mark) && (coach.chordAt[chord] || 0) >= mark.at;
  const keysHint = run => (run.keys ? ` Type each <code>${escapeHtml(SHORTCUTS[run.keys].token)}</code> with ${escapeHtml(run.keys)}.` : '');
  // Code in a hint: inline for one line, as a block for a statement over several.
  // Function and package names in it link to their documentation, as in the lesson's text.
  const codeHtml = text => (text.includes('\n') ? `<pre class="code">${linkNames(escapeHtml(text), {code: true})}</pre>` : `<code>${linkNames(escapeHtml(text), {code: true})}</code>`);
  // The second hint for a statement: its code with each value left blank (tools/provision.py), so it
  // shows which functions and arguments to use without the answer. Statements with nothing to blank
  // out have none.
  const blanksHint = run => (run.hint_partial ? `Fill in each ___: ${codeHtml(run.hint_partial)}` + keysHint(run) : null);
  // The control a hint points at for an IDE action.
  const actionControl = run => (run.action === 'menu' ? ide.menubar(run.menu[0])
    : run.action === 'option' ? ide.menubar('Tools')
    : run.action === 'format-document' ? ide.menubar('Code')
    : run.action === 'new-file' || run.action === 'new-project' ? ide.menubar('File')
    : run.action === 'source' ? ide.sourceRunButton()
    : ide.source());

  // ---------- Demonstration ----------
  class DemoStopped extends Error {}

  // Before the first step, the panel introduces the lesson and lists its steps. Once the learner
  // starts a step, that overview gives way to the current step alone: while the coach works, one
  // short line says what it is doing now ("Writing code to draw a line through the numbers 1 to
  // 10"), and once RStudio shows the result, the explanation replaces it. A reload shows the
  // overview again, with the steps done so far ticked, until the learner presses Next.
  //
  // Every line of narration, and every explanation but the last, waits for the learner to read
  // it (`readMs`, longer for longer text), as ELK Guide's reading beats do. The main button counts
  // the wait down ("Advance · 5s", "Next: step 3 · 12s") and a bar fills; pressing it moves on at
  // once, and otherwise the coach moves on when the countdown ends, into the next step after an
  // explanation. Advance pressed while the coach is acting ends the next wait as soon as it starts.
  //
  // Auto-advance (a switch, off by default, kept in localStorage) is the learner's pause: turned
  // off, the coach still works through a step by itself, but after the explanation it waits for
  // Next however long the learner takes. Turned off during an explanation's countdown, it stops
  // that countdown; turned on again, the countdown carries on from where it was.
  //
  // Start over resets the script and R (a fresh start) and then runs step 1 by itself, so every
  // line is typed again. `autostart` is that second half.
  function renderDemo({content, session, lesson: manifest, status, autostart, storeKey: keyFor, switchLabel, changeMode, startOver, finish, next}) {
    const steps = manifest.steps;
    content.innerHTML = `
      <div class="overview">
        ${lessonHeader(manifest, `Watch the coach type each ${manifest.version === 2 ? 'statement' : 'line'} into \`${manifest.script}\`, run it, and explain the result.`)}
        ${stepsBox(steps, true)}
        ${sourceLine(manifest)}
      </div>
      <section class="card" hidden>
        <h3></h3>
        <p class="phase" aria-live="polite"></p>
        <div class="explain" aria-live="polite"></div>
        <div class="timer" hidden><span></span></div>
      </section>
      <div class="row">
        <button class="primary go">Start demonstration</button>
        <button class="restart" hidden>Start over</button>
        ${next ? `<button class="primary next-lesson" hidden>${escapeHtml(next.label)}</button>` : ''}
      </div>
      <div class="row controls">
        <button class="auto" role="switch" aria-checked="false" aria-describedby="auto-off"><span class="track" aria-hidden="true"></span>Auto-advance</button>
        <button class="stop">Stop</button>
      </div>
      <p class="muted auto-off" id="auto-off" hidden>Auto-advance is off. After each step, the coach waits until you press <strong>Next</strong>.</p>
      <div class="row"><button class="switch">${switchLabel}</button></div>
      <p class="muted watch" hidden>The amber pointer is the coach's. While it works, watch RStudio and don't type in it.</p>`;
    const $ = sel => content.querySelector(sel);
    const card = $('.card');
    const phaseEl = $('.phase');
    const explainEl = $('.explain');
    const go = $('.go');
    const restart = $('.restart');
    const autoBtn = $('.auto');
    const AUTO_KEY = 'rsCoachAutoAdvance';
    let auto = (() => { try { return localStorage.getItem(AUTO_KEY) === '1'; } catch (_error) { return false; } })(); // storage blocked
    let held = null; // {i, ms}: step i's explanation, waiting for Next while Auto-advance is off

    const storeKey = keyFor('Demo');
    // reloadAt: the step whose action reloads the page (a new project), so that after the reload
    // the coach finishes that step rather than offering it again.
    const demo = (coach.demo = {state: 'idle', index: -1, completed: [], values: {}, failure: null, stopped: false, actions: 0, reloadAt: null});
    try {
      const saved = JSON.parse(sessionStorage.getItem(storeKey) || 'null');
      if (saved && Array.isArray(saved.completed) && (saved.completed.length || Number.isInteger(saved.reloadAt))) {
        Object.assign(demo, {completed: saved.completed, values: saved.values || {}, index: Math.max(-1, ...saved.completed), state: 'waiting',
          reloadAt: Number.isInteger(saved.reloadAt) ? saved.reloadAt : null});
        note('demo_restored', {completed: demo.completed.length, reloadAt: demo.reloadAt});
      }
    } catch (_error) { /* storage blocked */ }
    if (demo.completed.length) content.querySelector('.steps-box').open = true; // after a reload: the progress so far
    const persist = () => {
      try { sessionStorage.setItem(storeKey, JSON.stringify({completed: demo.completed, values: demo.values, reloadAt: demo.reloadAt})); } catch (_error) { /* storage blocked */ }
    };
    const setPhase = phaseSetter(phaseEl);
    let started = 0; // steps the learner has started since this panel opened

    // The learner's turn to read. countdown(ms) resolves true when it runs out or the learner
    // presses Advance, and false when it is cancelled (Stop, Start over, Next pressed early).
    const timerEl = $('.timer');
    const fill = timerEl.querySelector('span');
    const wait = {end: 0, done: null, tick: 0, queued: false};
    const counting = () => Boolean(wait.done);
    function bar(mode, ms = 0) {
      timerEl.hidden = !mode;
      timerEl.classList.toggle('working', mode === 'working');
      fill.style.transition = 'none';
      fill.style.width = '0%';
      if (mode !== 'reading') return;
      void fill.offsetWidth; // restart the fill
      fill.style.transition = `width ${ms}ms linear`;
      fill.style.width = '100%';
    }
    function countdown(ms) {
      endCountdown(false);
      if (wait.queued) { // Advance was pressed while the coach was acting
        wait.queued = false;
        renderControls();
        return Promise.resolve(true);
      }
      return new Promise(resolve => {
        Object.assign(wait, {end: Date.now() + ms, done: resolve});
        bar('reading', ms);
        const tick = () => {
          if (Date.now() >= wait.end) { endCountdown(true); return; }
          renderControls();
          wait.tick = setTimeout(tick, 200);
        };
        tick();
      });
    }
    function endCountdown(moveOn) {
      clearTimeout(wait.tick);
      const done = wait.done;
      if (!done) return;
      wait.done = null;
      bar(demo.state === 'running' && !demo.stopped ? 'working' : null);
      renderControls();
      done(moveOn);
    }
    const drive = makeDriver(manifest, demo, setPhase, async text => {
      const ms = readMs(text);
      note('demo_read', {text, ms});
      if (!(await countdown(ms))) throw new DemoStopped();
    });

    function nextIndex() {
      if (demo.state === 'failed') return demo.index;
      const i = demo.index + 1;
      return i < steps.length ? i : null;
    }
    function renderControls() {
      for (const li of content.querySelectorAll('li[data-step]')) {
        const i = Number(li.dataset.step);
        li.className = demo.state === 'failed' && i === demo.index ? 'failed'
          : demo.state === 'running' && i === demo.index ? 'active'
          : demo.completed.includes(i) ? 'done' : '';
      }
      const next = nextIndex();
      const running = demo.state === 'running';
      const left = counting() ? Math.max(1, Math.ceil((wait.end - Date.now()) / 1000)) : 0;
      go.disabled = running ? wait.queued : next === null;
      go.textContent = demo.state === 'idle' ? 'Start demonstration'
        : running ? (wait.queued ? 'Advancing when ready…' : left ? `Advance · ${left}s` : 'Advance')
        : demo.state === 'failed' ? 'Try this step again'
        : next === null ? 'Demonstration complete'
        : left ? `Next: step ${next + 1} · ${left}s` : `Next: step ${next + 1}`;
      go.title = left ? 'Move on now. Otherwise the coach moves on when the countdown ends.' : '';
      autoBtn.setAttribute('aria-checked', String(auto));
      $('.auto-off').hidden = auto || demo.state === 'stopped';
      restart.hidden = !(demo.state === 'failed' || (demo.state !== 'running' && demo.completed.length));
      const complete = demo.state !== 'running' && demo.completed.length === steps.length;
      const nextLesson = $('.next-lesson');
      if (nextLesson) nextLesson.hidden = !complete;
      go.hidden = Boolean(nextLesson) && complete;
      $('.overview').hidden = started > 0;
      $('.watch').hidden = demo.state !== 'running' || started > 1; // the first time the pointer appears
    }

    // The coach's pointer sets off from the button the learner just pressed.
    function begin() {
      const i = nextIndex();
      if (i === null) return;
      endCountdown(false); // the explanation's countdown: the learner moved on first
      clearHighlight();
      pointerFrom(go);
      runStep(i);
    }
    autoBtn.addEventListener('click', () => {
      auto = !auto;
      try { localStorage.setItem(AUTO_KEY, auto ? '1' : '0'); } catch (_error) { /* storage blocked */ }
      note('demo_auto_advance_switch', {on: auto, state: demo.state});
      if (!auto && demo.state === 'waiting' && counting()) {
        // The explanation's countdown stops where it is, until Auto-advance is back on or Next.
        const left = Math.max(0, wait.end - Date.now());
        endCountdown(false);
        held = {i: demo.index, ms: left};
      } else if (auto && held && demo.state === 'waiting' && demo.index === held.i) {
        const {i, ms} = held;
        held = null;
        continueAfterReading(i, Math.max(ms, 1500));
      }
      renderControls();
    });
    go.addEventListener('click', () => {
      if (demo.state !== 'running') { begin(); return; }
      note('demo_advance', {counting: counting()}); // Advance
      if (counting()) endCountdown(true);
      else { wait.queued = true; renderControls(); }
    });
    restart.addEventListener('click', () => {
      if (demo.state === 'running') return;
      note('demo_start_over');
      startOver();
    });
    const halt = () => {
      demo.stopped = true;
      held = null;
      wait.queued = false;
      endCountdown(false);
      bar(null);
      spotlight(null);
      clearHighlight();
      showPointer(false);
    };
    $('.stop').addEventListener('click', () => {
      halt();
      demo.state = 'stopped';
      try { sessionStorage.removeItem(storeKey); } catch (_error) { /* storage blocked */ }
      note('stop');
      endedView(content, 'This demonstration has ended. RStudio stays open, with everything the coach ran.', changeMode, switchLabel);
    });
    $('.switch').addEventListener('click', () => changeMode());
    $('.next-lesson')?.addEventListener('click', () => next.go());

    async function runStep(i) {
      const step = steps[i];
      Object.assign(demo, {index: i, state: 'running', failure: null, stopped: false});
      wait.queued = false;
      held = null;
      started += 1;
      card.hidden = false;
      $('.card h3').innerHTML = `Step ${i + 1} of ${steps.length}: ${linkedTitle(step.title)}`;
      explainEl.replaceChildren();
      bar('working');
      renderControls();
      note('demo_step_started', {step: step.id});
      try {
        let firstEcho = -1;
        for (const run of step.runs) {
          if (run.action) {
            if (run.action === 'new-project') { demo.reloadAt = i; persist(); } // RStudio reloads the page
            await drive.doAction(run, step, i);
            continue;
          }
          await drive.openScript(); // an action (a new file, Render) may have shown another tab
          await drive.doRun(run, step, i);
          if (firstEcho < 0) firstEcho = demo.echoAt;
          if (run.tour === 'plot-history') await drive.plotHistory();
        }
        // No Save: the script stays as typed, unsaved, as a learner's would. Nothing checks the file.
        explainStep(i, firstEcho);
      } catch (error) {
        if (stepFailed(step, error)) return; // stopped: the panel may already be gone
      }
      renderControls();
    }

    // Every result step i explains is now on screen and matches the reference run. The dimming
    // lifts, and a ring stays on what the explanation talks about while it is read.
    function explainStep(i, firstEcho = -1) {
      const step = steps[i];
      setPhase('');
      showPointer(false);
      spotlight(null);
      const charts = step.runs.some(r => ['plot', 'ggplot'].includes(r.evidence));
      const pane = step.runs.some(r => r.ide?.viewer) ? ide.viewer : step.runs.some(r => r.ide?.help) ? ide.help : null;
      highlight(charts ? ide.plots : pane || (firstEcho >= 0 ? () => consoleRangeRect(firstEcho) : ide.console), Infinity);
      // The note about the Plots arrows, unless the coach has just shown them.
      const toured = step.runs.some(run => run.tour === 'plot-history');
      explainEl.innerHTML = explainHtml(step, demo.values, demo.conflicts ?? null) + (firstReplacementChart(manifest)?.s === i && !toured ? PLOT_HISTORY_NOTE : '');
      demo.completed = [...new Set([...demo.completed, i])];
      demo.state = 'waiting';
      demo.reloadAt = null;
      wait.queued = false; // an Advance pressed while the coach acted hurried the coach, not this explanation
      bar(null);
      persist();
      note('demo_step_done', {step: step.id, values: {...demo.values}});
      if (i === steps.length - 1) {
        status(`Demonstration complete · ${manifest.title}`);
        finish?.();
      } else {
        continueAfterReading(i);
      }
    }
    // Returns true if the step was stopped (Stop, Start over, a mode change) rather than failed.
    function stepFailed(step, error) {
      showPointer(false);
      spotlight(null);
      demo.reloadAt = null;
      persist();
      if (error instanceof DemoStopped || demo.stopped) return true;
      bar(null);
      demo.state = 'failed';
      demo.failure = error.message;
      clearHighlight();
      setPhase('');
      explainEl.innerHTML = `<p class="error">The demonstration stopped at this step. ${escapeHtml(error.message)}</p>`
        + (error instanceof SlowConnection ? '<p>When the connection is back, press <strong>Try this step again</strong>. The coach runs the code that is already in the script, without typing it again.</p>' : '');
      note('demo_step_failed', {step: step.id, reason: error.message});
      return false;
    }

    // After the reload a new project causes: wait until R's evidence shows RStudio in the new
    // project, then explain the step. (A new project is always a lesson's last statement.)
    async function resumeAfterReload(i) {
      const step = steps[i];
      Object.assign(demo, {index: i, state: 'running', failure: null, stopped: false});
      started += 1;
      card.hidden = false;
      $('.card h3').textContent = `Step ${i + 1} of ${steps.length}: ${step.title}`;
      bar('working');
      renderControls();
      setPhase('RStudio is opening the new project');
      const run = step.runs.find(r => r.action === 'new-project');
      try {
        for (const t = Date.now(); !ideHolds(run.ide, await readEvidence(0), null); await sleep(500)) {
          if (demo.stopped) throw new DemoStopped();
          if (Date.now() - t > 60000) throw new Error('RStudio did not open the new project within a minute.');
        }
        explainStep(i);
      } catch (error) {
        if (stepFailed(step, error)) return;
      }
      renderControls();
    }

    // The next step starts by itself once the learner has had time to read the explanation,
    // unless they press Next first (or Stop, or Start over), or Auto-advance is off.
    async function continueAfterReading(i, ms = readMs(explainEl.textContent)) {
      if (!auto) {
        held = {i, ms};
        note('demo_hold', {step: steps[i].id});
        return;
      }
      note('demo_read', {text: 'explanation', step: steps[i].id, ms});
      if (!(await countdown(ms)) || demo.stopped || demo.state !== 'waiting' || demo.index !== i) return;
      note('demo_auto_advance', {step: steps[i + 1].id});
      clearHighlight();
      pointerFrom(go);
      runStep(i + 1);
    }

    renderControls();
    if (Number.isInteger(demo.reloadAt)) resumeAfterReload(demo.reloadAt);
    else if (autostart) begin();
    return () => { halt(); coach.demo = null; };
  }

  // Works RStudio the way a learner does: the coach's pointer moves to each control it clicks,
  // and code is typed one key at a time. Demonstration uses it for every line, Guided for Show me.
  // Setting `state.stopped` halts it at the next frame or keystroke.
  //
  // Each line of narration gets one turn to be read: before a click it announces the click, and
  // after typing or a result it lets the learner take in what changed. Demonstration passes
  // `hold(text)` for that turn (its countdown). Without one (Show me), the coach keeps its own
  // pace instead: a short lead before clicks and a dwell on results.
  function makeDriver(manifest, state, setPhase, hold = null) {
    const script = manifest.script;
    const check = () => { if (state.stopped) throw new DemoStopped(); };
    const pause = async (ms = paceMs) => { await sleep(ms); check(); };
    let unread = null; // the narration on screen, until its turn to be read has passed
    const say = text => { setPhase(text); unread = text; };
    async function heed(ms = 0) {
      const text = unread;
      unread = null;
      if (text !== null && hold) await hold(text);
      else if (ms) await sleep(ms);
      check();
    }

    const openScript = () => openFile(script);
    async function openFile(script) {
      const isOpen = () => ide.scriptEditor(script);
      if (isOpen()) return;
      // RStudio re-renders the Files list and tab strip when files change, so look the
      // target up again after each pause and retry if the click landed on a stale element.
      const target = () => ide.sourceTab(script) || ide.fileLink(script);
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        if (ide.sourceTab(script)) {
          say(`Switching to ${script} in the Source pane`);
        } else {
          say(`Opening ${script} from the Files pane`);
          if (!ide.files() && ide.filesTab()) { await clickOn(ide.filesTab, 'files_tab'); await pause(400); }
          if (!ide.fileLink(script) && ide.filesHome()) { await clickOn(ide.filesHome, 'files_home'); await pause(600); } // Files shows another folder
        }
        if (!(await waitFor(target, 5000))) {
          throw new Error(`${script} is not listed in the Files pane. Show the project folder in Files, then try again.`);
        }
        // With many files, the script can be below the fold of the Files list: scroll to it first.
        if (!ide.sourceTab(script)) await scrollIntoList(ide.fileLink(script));
        if (!(await clickOn(target, 'open_script'))) continue;
        note('demo_action', {action: 'open_script', script, attempt});
        if (await waitFor(isOpen, 4000)) { await pause(); return; }
      }
      throw new Error(`${script} did not open in the Source pane.`);
    }

    // Scroll a list (the Files pane) so `el` is in view, as a learner scrolls before clicking.
    async function scrollIntoList(el) {
      if (!el) return;
      let box = el.parentElement;
      while (box && box !== document.body && !/auto|scroll/.test(getComputedStyle(box).overflowY)) box = box.parentElement;
      if (!box || box === document.body) return;
      const r = el.getBoundingClientRect();
      const b = box.getBoundingClientRect();
      if (r.top >= b.top && r.bottom <= b.bottom) return;
      el.scrollIntoView({block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth'});
      note('demo_action', {action: 'scroll_files'});
      await pause(500);
    }

    // Move the pointer to a control and click it there. `find` is called again on arrival,
    // because RStudio re-renders the Files list and toolbars when files change. `lone` sends only
    // the click event, which a menu item that opens a submenu needs (a full press opens and shuts it).
    async function clickOn(find, what, {lone = false} = {}) {
      spotlight(find);
      await heed(leadMs); // the spotlight arrives before the pointer sets off
      for (let attempt = 0; attempt < 3; attempt += 1) {
        if (!(await glide(() => centre(find()), check))) return null;
        await pause(150);
        const el = find();
        if (!el) return null;
        const r = el.getBoundingClientRect();
        if (pointer.x < r.left || pointer.x > r.right || pointer.y < r.top || pointer.y > r.bottom) continue; // it moved
        pointerClickEffect();
        press(el, {x: pointer.x, y: pointer.y}, lone ? ['click'] : undefined);
        state.actions += 1;
        note('demo_click', {target: what, x: Math.round(pointer.x), y: Math.round(pointer.y)});
        return el;
      }
      return null;
    }

    // Click at a place in the Source editor, the way a learner puts the cursor there.
    async function clickInEditor(editor, row, column) {
      const renderer = editor.renderer;
      renderer.scrollCursorIntoView({row, column}, 0.5);
      const point = () => {
        const at = renderer.textToScreenCoordinates(row, column);
        const box = renderer.scroller.getBoundingClientRect();
        return {x: clamp(at.pageX + 2, box.left + 4, box.right - 6), y: clamp(at.pageY + renderer.lineHeight / 2, box.top + 4, box.bottom - 4)};
      };
      await glide(point, check);
      await pause(150);
      pointerClickEffect();
      editor.focus();
      editor.clearSelection();
      editor.moveCursorTo(row, column);
      state.actions += 1;
      note('demo_click', {target: 'editor', line: row + 1, x: Math.round(pointer.x), y: Math.round(pointer.y)});
    }

    // Press Enter at the end of `row`, then type the statement one key at a time, line by line.
    // RStudio's own behaviour runs, as it does for a learner: "(" also adds ")", typing ")" types
    // over it, and Enter indents the next line. Where RStudio's indentation differs from the
    // reference's, the coach sets it, as a learner would with Backspace or Tab. When Enter falls
    // between a pair, RStudio moves the closer down a line; if the reference's next line starts with
    // that closer, the coach steps down onto it (as a learner presses ↓) rather than pressing Enter,
    // so the statement doesn't end up with the closer twice.
    // With `shortcut` (Ctrl+Shift+M or Alt+-), each |> or <- is typed with it, as the lesson teaches.
    async function typeStatement(editor, row, code, shortcut = null) {
      const session = editor.session;
      const lines = code.split('\n');
      const lengthBefore = session.getLength();
      const first = row + 1;
      const tailStart = () => first + (session.getLength() - lengthBefore); // the first row that was below `row`
      const closers = ')]}"\'';
      const setIndent = (r, indent) => {
        const text = session.getLine(r);
        const current = text.length - text.trimStart().length;
        if (current !== indent) session.replace({start: {row: r, column: 0}, end: {row: r, column: current}}, ' '.repeat(indent));
      };
      const moveTo = (r, column) => { editor.clearSelection(); editor.moveCursorTo(r, column); };
      showPointer(false); // like most systems, hide the mouse pointer while typing
      const started = Date.now();
      moveTo(row, session.getLine(row).length);
      editor.insert('\n', true);
      state.actions += 1;
      let keys = 0;
      for (let li = 0; li < lines.length; li += 1) {
        const want = lines[li];
        const body = want.trimStart();
        const indent = want.length - body.length;
        const r = first + li;
        if (li > 0) {
          await pause(typeMs * 2);
          const rest = session.getLine(r - 1).slice(lines[li - 1].length);
          const below = session.getLine(r).trim();
          if (!rest.trim() && r < tailStart() && body && ')]}'.includes(body[0]) && below[0] === body[0]) moveTo(r, 0); // ↓
          else editor.insert('\n'); // Enter
          state.actions += 1;
        }
        setIndent(r, indent);
        moveTo(r, indent);
        // Bring a new line below the editor's visible part into view, and so into the spotlight,
        // before its first key: Ace scrolls only when the coach asks, after each key.
        editor.renderer.scrollCursorIntoView(null, 0.5);
        for (let i = 0; i < body.length; i += 1) {
          await pause(keyGap(body, i));
          const c = body[i];
          const column = indent + i;
          const at = editor.getCursorPosition();
          if (at.row !== r || at.column !== column) moveTo(r, column);
          const token = shortcut && SHORTCUTS[shortcut].token;
          if (token && body.startsWith(token, i)) {
            const before = session.getLine(r);
            sendKeys(editor.textInput.getElement(), shortcut);
            await pause(typeMs);
            const cursor = editor.getCursorPosition();
            // RStudio types " |> " or " <- ", a space each side; keep the reference's spacing (no trailing space).
            if (session.getLine(r) !== before && cursor.row === r) session.replace({start: {row: r, column: 0}, end: {row: r, column: cursor.column}}, want.slice(0, column + 2));
            else editor.insert(token); // the shortcut did nothing here
            moveTo(r, column + 2);
            note('demo_action', {action: 'shortcut', keys: shortcut});
            state.actions += 1;
            keys += 1;
            i += 1;
            continue;
          }
          if (closers.includes(c) && session.getLine(r)[column] === c) moveTo(r, column + 1); // added with its pair: type over it
          else editor.insert(c);
          // RStudio re-indents some lines as they are typed (a closing brace, say): keep the reference's.
          if (!session.getLine(r).startsWith(want.slice(0, column + 1))) {
            setIndent(r, indent);
            moveTo(r, column + 1);
          }
          editor.renderer.scrollCursorIntoView(null, 0.5);
          state.actions += 1;
          keys += 1;
        }
      }
      // Closers RStudio added that the statement already has: after its last line, and on rows below.
      const last = first + lines.length - 1;
      const after = session.getLine(last).slice(lines[lines.length - 1].length);
      if (after && /^[\s)\]}"']*$/.test(after)) {
        session.remove({start: {row: last, column: lines[lines.length - 1].length}, end: {row: last, column: session.getLine(last).length}});
      }
      while (tailStart() > last + 1 && /^[\s)\]}"']*$/.test(session.getLine(last + 1))) session.removeFullLines(last + 1, last + 1);
      note('demo_action', {action: 'type', line: first + 1, lines: lines.length, chars: code.length, keys, ms: Date.now() - started});
      const typed = session.getLines(first, last).join('\n');
      if (typed !== code || tailStart() !== last + 1) {
        throw new Error(`${script} reads ${JSON.stringify(session.getLines(first, tailStart() - 1).join('\n'))} where the coach typed ${JSON.stringify(code)}. Something else edited it while the coach was typing.`);
      }
      return {first, last};
    }

    // Each statement is narrated by what it is for (the run's `purpose`, from scenario.json), not by
    // where it goes: "Writing code to find the highest temperature".
    async function doRun(run, step, index) {
      const heading = step.heading || `# Step ${index + 1}. ${step.title}`;
      const editor = ide.activeEditor();
      if (!editor) throw new Error(`${script} is not open in the Source pane.`);
      const lines = editor.session.getDocument().getAllLines();
      const block = stepBlock(lines, heading);
      if (!block) {
        throw new Error(`${script} no longer has the line ${heading}, so the coach can't tell where step ${index + 1} goes. Put the heading back, or start this mode again to reset the script.`);
      }
      // The spotlight takes in the step's heading and the lines the statement goes on.
      const headingRow = block.start - 1;
      const count = run.code.split('\n').length;
      let row = findStatement(lines, block, run.code);
      let last = row + count - 1;
      if (row >= 0) {
        // Already there (typed earlier, or by the learner): run it as it is rather than type it twice.
        say(`The code to ${run.purpose} is already in the script, so it runs again as it is`);
        spotlight(() => editorRowsRect(editor, headingRow, last));
        await pause(leadMs);
        await clickInEditor(editor, row, 0); // at its start, so a long line doesn't scroll the editor sideways
      } else {
        say(`Writing code to ${run.purpose}` + (run.keys ? `, typing each |> with ${run.keys}` : ''));
        spotlight(() => editorRowsRect(editor, headingRow, Math.max(block.last + 1, editor.getCursorPosition().row)));
        await pause(leadMs);
        await clickInEditor(editor, block.last, lines[block.last].length);
        ({first: row, last} = await typeStatement(editor, block.last, run.code, run.keys));
        spotlight(() => editorRowsRect(editor, headingRow, last));
      }
      await heed(400);

      // With no selection, Run sends the whole statement the cursor is in, from any of its lines
      // (checked in RStudio 2026.11, "execution_behavior": "statement"). After typing, the cursor
      // is at the end of the statement's last line, as a learner's is, so it runs from there.
      const runMenu = !ide.runButton() && ide.runMenu();
      const press = runMenu ? 'Pressing **Run › Run Selected Line(s)**' : 'Pressing **Run**';
      const pressing = count > 1 ? `${press} to send the whole statement, every line of it, to the Console (**Ctrl+Enter** does the same)`
        : `${press} to send this line to the Console (**Ctrl+Enter** does the same)`;
      say(pressing);
      // After a Render, RStudio's Background Jobs tab can cover the Console; a learner would bring it back.
      if (!shown(document.getElementById('rstudio_console_input')) && ide.consoleTab()) {
        say('Bringing the Console to the front');
        await clickOn(ide.consoleTab, 'console tab');
        say(pressing);
      }
      const before = {echoes: countEchoes(ide.consoleText(), run.code), plot: ide.plotImage()?.src || null,
        mark: usesEvidence(run) ? await patientMark(setPhase, pressing) : null};
      if (runMenu) {
        if (!(await clickOn(ide.runMenu, 'run menu'))) throw new Error('The Run menu in the Source pane is not visible.');
        const item = () => ide.menuItem(/^Run Selected Line/);
        if (!(await waitFor(item, 4000))) throw new Error('The Run menu has no Run Selected Line(s) item.');
        await clickOn(item, 'menu Run Selected Line(s)');
      } else if (!(await clickOn(ide.runButton, 'run'))) throw new Error('The Run button in the Source pane is not visible.');
      note('demo_action', {action: 'run', line: row + 1, lines: count});

      const charts = ['plot', 'ggplot'].includes(run.evidence);
      spotlight(charts ? ide.plots : ide.console);
      const seenOutput = await waitForEvidence(run, before);
      const output = seenOutput ?? '';
      const echoAt = seenOutput === null ? -1 : ide.consoleText().lastIndexOf(echoOf(run.code));
      state.echoAt = echoAt;
      if (run.capture) {
        for (const [name, pattern] of Object.entries(run.capture)) {
          // Read the value from what the Console shows. If RStudio wrapped the printout to
          // fit a narrow pane, the tokens already match the reference, so use its reading.
          const seen = (new RegExp(pattern).exec(normalise(output)) || [])[1] ?? run.expected_values[name];
          if (seen !== run.expected_values[name]) {
            throw new Error(`RStudio showed ${name} = ${seen}, but the reference run for this scenario gave ${run.expected_values[name]}.`);
          }
          state.values[name] = seen;
        }
      } else {
        // R's value has the reference's fingerprint, so it is the reference's value: quote the bake's.
        Object.assign(state.values, run.expected_values || {});
      }
      // Hold the result in the spotlight long enough to find and read it.
      const stored = run.evidence === 'assign' ? run.expected?.assigned
        : run.show === 'environment' ? /^\s*([A-Za-z.][\w.]*)\s*(?:<-|=)/.exec(run.code)?.[1] : null;
      const printed = normalise(output);
      if (attachesTidyverse(run)) state.conflicts = seenOutput === null ? null : showedConflicts(output);
      if (charts) {
        spotlight(ide.plots);
        say(state.chartPending ? 'R drew the chart. Over this slow connection, it is still loading in the Plots pane'
          : 'R drew the chart in the Plots pane');
      } else if (run.ide?.help) {
        spotlight(ide.help);
        say('The help page is open in the Help pane');
      } else if (run.ide?.viewer) {
        spotlight(ide.viewer);
        say('The Viewer pane shows the result');
      } else if (stored) {
        spotlight(() => environmentRowRect(stored) || ide.environment());
        say(`\`${stored}\` now appears in the Environment pane. An assignment prints nothing in the Console`);
      } else {
        spotlight(echoAt >= 0 ? () => consoleRangeRect(echoAt) : ide.console);
        say(run.evidence === 'error' ? 'R stopped with an error, shown in the Console'
          : run.evidence === 'attached' ? (attachesTidyverse(run) && /Conflicts/.test(output)
            ? 'R loaded the tidyverse. The Console lists its packages, and the red “Conflicts” lines are normal'
            : printed ? `R loaded ${run.expected?.library}, and the Console shows its message`
            : `R loaded ${run.expected?.library}. It was loaded already, so the Console shows nothing new`)
          : run.evidence === 'file' ? `R wrote ${run.path} into the project folder`
          : printed && printed.length <= 40 ? `R printed \`${printed}\` in the Console` : 'R printed the result in the Console');
      }
      await heed(dwellMs);
      return output;
    }

    // Done only when RStudio shows the statement ran and R's evidence agrees with the reference: the
    // same fingerprint (or for older lessons, the same printed output), plus a newly loaded chart for
    // a chart. An R error stops the statement visibly, unless the statement is meant to fail. R
    // usually answers within a second, so "Pressing Run…" stays up until then; a slower statement
    // says it is running.
    //
    // On a slow connection, the Console's echo, R's record and the chart's image each take their
    // time to arrive. While RStudio is still waiting on the connection, the coach keeps waiting too
    // (up to 5 minutes), and says so. R's record of the statement counts on its own: once it
    // matches, the coach waits at most 5 s more for the echo and 10 s more for the chart's image,
    // then carries on, and says the chart is still loading. Returns the Console output, or null if
    // the echo never arrived.
    async function waitForEvidence(run, before) {
      const charts = ['plot', 'ggplot'].includes(run.evidence);
      const began = Date.now();
      let deadline = began + 30000;
      const cap = began + 300000;
      let slowAt = began + 1500;
      let saying = '';
      let matchedAt = 0;
      let recordAt = 0; // when R's record first matched, with no echo or image yet
      let seen = {echo: false, output: '', plot: false, ok: false};
      const echo = echoOf(run.code);
      const record = usesEvidence(run) && run.evidence !== 'error';
      for (;;) {
        check();
        const link = connection();
        if (link !== 'ok' && link !== 'failed') deadline = Math.min(cap, Math.max(deadline, Date.now() + 30000));
        if (Date.now() > slowAt && !matchedAt) {
          const say = link === 'offline' ? 'The browser is offline. The coach is waiting for the connection to come back…'
            : link === 'slow' ? `RStudio is still waiting for R's answer. The connection may be slow (${Math.round((Date.now() - began) / 1000)} s)…`
            : charts ? 'R is still drawing the chart…' : 'R is still running the statement…';
          if (say !== saying) { saying = say; setPhase(say); }
        }
        if (record && !seen.ok) {
          const match = evidenceMatch(run, latestEvidence(), before.mark);
          if (match && !recordAt) recordAt = Date.now();
          const img = ide.plotImage();
          const newChart = Boolean(img && img.src !== before.plot && img.complete && img.naturalWidth > 0);
          // R ran it, but its echo (or its chart's image) is still on the way.
          if (recordAt && Date.now() - recordAt > (charts && !newChart ? 10000 : 5000)) {
            note('result_by_record', {echo: seen.echo, chart: newChart, waitedMs: Date.now() - began});
            state.chartPending = charts && !newChart;
            return seen.echo ? seen.output : null;
          }
        }
        const text = ide.consoleText();
        if (countEchoes(text, run.code) > before.echoes) {
          const at = text.lastIndexOf(echo);
          const end = text.indexOf('\n', at + echo.length);
          const output = end < 0 ? '' : text.slice(end + 1);
          const error = consoleError(output);
          if (error && run.evidence !== 'error') throw new Error(`R reported: ${error}`);
          const img = ide.plotImage();
          const newChart = Boolean(img && img.src !== before.plot && img.complete && img.naturalWidth > 0);
          let ok;
          if (run.evidence === 'console') ok = sameTokens(output, run.expected_output);
          else if (run.evidence === 'plot') ok = newChart && sameTokens(output, run.expected_output);
          else if (run.evidence === 'pattern') ok = new RegExp(run.pattern).test(output.trim());
          else if (run.evidence === 'error') ok = Boolean(error) && new RegExp(run.error).test(error);
          else ok = Boolean(evidenceMatch(run, latestEvidence(), before.mark)) && (run.evidence !== 'ggplot' || newChart);
          seen = {echo: true, output, plot: newChart, ok};
          if (ok) {
            matchedAt = matchedAt || Date.now();
            if (Date.now() - matchedAt >= 300) { state.chartPending = false; return output; } // stable: no late error or extra output
          } else {
            matchedAt = 0;
          }
        }
        if (Date.now() > deadline) {
          const link = connection();
          if (link !== 'ok') {
            throw new SlowConnection(link === 'failed' ? 'RStudio lost its connection while the statement ran.'
              : `RStudio has waited ${Math.round((Date.now() - began) / 1000)} s for R's answer. The connection may be slow.`);
          }
          if (!seen.echo) throw new Error('The Console never showed the statement, so RStudio did not run it.');
          if (charts && !seen.plot) throw new Error('No new chart appeared in the Plots pane.');
          if (run.evidence === 'error') throw new Error(`R didn't report the error this statement shows (${run.error}).`);
          if (['console', 'plot'].includes(run.evidence)) {
            throw new Error(`The Console showed "${normalise(seen.output).slice(0, 120)}" instead of the reference output "${normalise(run.expected_output).slice(0, 120)}".`);
          }
          if (run.evidence === 'pattern') throw new Error(`The Console showed "${normalise(seen.output).slice(0, 120)}", which isn't what this statement prints.`);
          throw new Error(evidence.failures && !evidence.doc?.session ? 'The coach can\'t read what R did, so it can\'t confirm the result.'
            : 'R\'s result differs from the reference result for this statement.');
        }
        await sleep(100);
      }
    }

    // A tour of the chart history, after a chart that replaced another on screen (a run's
    // "tour": "plot-history"; lesson 1): the Plots pane's left arrow goes back to the earlier chart,
    // which is still there, and the right arrow returns to the newest. Demonstration only.
    async function plotHistory() {
      const arrow = id => () => { const el = byId(id); return el && shown(el) && !el.disabled ? el : null; };
      const back = arrow('rstudio_tb_previousplot');
      const forward = arrow('rstudio_tb_nextplot');
      const showing = () => ide.plotImage()?.src || null;
      const newest = showing();
      if (!back()) throw new Error('The Plots pane has no earlier chart to go back to.');
      say('The earlier chart is still in the Plots pane. Pressing the **left arrow** above it to go back');
      if (!(await clickOn(back, 'previous plot'))) throw new Error('The left arrow above the Plots pane is not visible.');
      const loaded = () => { const img = ide.plotImage(); return img && img.src !== newest && img.complete && img.naturalWidth > 0; };
      if (!(await waitFor(loaded, 10000))) throw new Error('The earlier chart did not appear in the Plots pane.');
      spotlight(ide.plots);
      say('This is the chart from before. Every chart drawn in this R session stays in this history');
      await heed(dwellMs);
      say('Pressing the **right arrow** to come back to the newest chart');
      if (!(await clickOn(forward, 'next plot'))) throw new Error('The right arrow above the Plots pane is not visible.');
      if (!(await waitFor(() => showing() === newest && ide.plotImage().complete, 10000))) throw new Error('The newest chart did not come back.');
      spotlight(ide.plots);
      say('The newest chart is back');
      await heed(dwellMs);
      note('demo_action', {action: 'plot_history'});
    }

    // IDE actions, worked the way a learner works them: the pointer goes to each menu, dialog and
    // control in turn. Done once the evidence (or RStudio) shows the result.
    async function doAction(run, step, index) {
      const mark = await patientMark(setPhase, null);
      const purpose = run.purpose ? run.purpose[0].toUpperCase() + run.purpose.slice(1) : 'Working RStudio';
      if (run.action === 'menu') {
        say(`${purpose}: ${run.menu.join(' › ')}`);
        await menuPath(run.menu);
      } else if (run.action === 'open-file') {
        await openFile(run.file);
      } else if (run.action === 'option') {
        say(`${purpose}: Tools › Global Options › ${run.pane}`);
        await setOption(run);
      } else if (run.action === 'format-document') {
        say(`${purpose}: Code › Reformat Document`);
        await menuPath(['Code', 'Reformat Document']);
      } else if (run.action === 'new-file') {
        say(`${purpose}: File › New File › ${run.kind}`);
        await menuPath(['File', 'New File', run.kind]);
        const dialog = () => ide.dialog(new RegExp(`New ${run.kind.replace(/…|\.\.\.$/, '')}`));
        if (await waitFor(dialog, 4000)) {
          // The lessons type into the source editor; RStudio's dialog remembers the visual editor if it was used before.
          const visual = () => [...dialog().querySelectorAll('label')].find(l => shown(l) && /visual markdown editor/i.test(l.textContent));
          const box = visual() && (visual().htmlFor ? document.getElementById(visual().htmlFor) : visual().parentElement.querySelector('input[type="checkbox"]'));
          if (box?.checked) {
            await clickOn(visual, 'dialog visual editor');
            if (box.checked) box.click();
          }
          await clickOn(() => ide.dialogButton(dialog(), 'Create'), 'dialog Create');
        }
      } else if (run.action === 'render') {
        say(`${purpose}: the Render button`);
        if (!(await clickOn(() => ide.sourceButton(/^Render\b/), 'render'))) throw new Error('The Render button is not visible.');
      } else if (run.action === 'editor-mode') {
        const label = run.to === 'visual' ? 'Visual' : 'Source';
        say(`${purpose}: the ${label} button`);
        const toggle = () => [...document.querySelectorAll('#rstudio_Source_pane button, #rstudio_Source_pane [role="button"], #rstudio_Source_pane [role="tab"]')]
          .find(b => shown(b) && (b.textContent.trim() === label || b.getAttribute('title') === label));
        if (!(await clickOn(toggle, `editor ${label}`))) throw new Error(`The ${label} button is not visible.`);
        // RStudio asks once, before the first switch to visual mode.
        const ask = () => ide.dialog(/Switch to Visual Mode/);
        if (run.to === 'visual' && await waitFor(() => ask() || ide.visualEditor(), 10000) && ask()) {
          await clickOn(() => ask() && [...ask().querySelectorAll('button')].find(b => shown(b) && /Use Visual Mode/.test(b.textContent)), 'dialog Use Visual Mode');
        }
      } else if (run.action === 'type') {
        await openScript();
        const editor = ide.activeEditor();
        if (!editor) throw new Error(`${script} is not open in the Source pane.`);
        const lines = editor.session.getDocument().getAllLines();
        let row = run.after ? lines.findIndex(line => new RegExp(run.after).test(line)) : lines.length - 1;
        if (row < 0) throw new Error(`${script} has no line matching ${run.after}, so the coach can't tell where this goes. Start this mode again to reset it.`);
        if (!run.after) while (row > 0 && !lines[row].trim()) row -= 1; // after the last line with text
        say(`Writing ${run.purpose}`);
        spotlight(() => editorRowsRect(editor, row, Math.max(row + 1, editor.getCursorPosition().row)));
        await pause(leadMs);
        await clickInEditor(editor, row, lines[row].length);
        const {first, last} = await typeStatement(editor, row, run.text);
        spotlight(() => editorRowsRect(editor, first, last));
        await heed(400);
      } else if (run.action === 'source') {
        // Source saves the script itself, then runs the saved file.
        await openScript();
        say(`${purpose}: the Source button`);
        // Straight after Restart R, RStudio can fail to save the script first ("Error Saving File …
        // jsonrpc error"). Like a learner, the coach dismisses the message and tries again.
        for (let attempt = 1; ; attempt += 1) {
          if (!(await clickOn(ide.sourceRunButton, 'source'))) throw new Error('The Source button above the script is not visible.');
          const failed = await waitFor(() => ide.dialog(/Error Saving File/), 2000);
          if (!failed) break;
          press(ide.dialogButton(failed, 'OK'));
          if (attempt >= 3) throw new Error('RStudio could not save the script before sourcing it.');
          await pause(2000);
        }
      } else if (run.action === 'new-project') {
        await newProject(run, purpose);
      } else if (run.action === 'shortcut') {
        say(`${purpose}: ${run.keys}`);
        // Into the open document, in whichever editor it shows.
        const visual = ide.visualEditor();
        const editor = visual ? null : ide.activeEditor();
        if (!visual && !editor) throw new Error('No document is open in the Source pane.');
        if (editor) editor.focus(); else visual.focus();
        sendKeys(editor ? editor.textInput.getElement() : visual, run.keys);
        state.actions += 1;
      } else {
        throw new Error(`The coach can't do the action ${run.action}.`);
      }
      note('demo_action', {action: run.action, step: step.id});
      if (run.action !== 'type') spotlight(run.action === 'render' ? ide.viewer : ide.console); // typed text keeps its spotlight
      const started = Date.now();
      let slow = false;
      for (;;) {
        check();
        if (run.evidence === 'file' || run.evidence === 'ide' ? evidenceMatch(run, await readEvidence(), mark) : true) break;
        if (!slow && run.ide?.restarted && Date.now() - started > 4000) {
          slow = true;
          setPhase('R is restarting. Just after RStudio starts, this can take up to 30 seconds.');
        }
        if (Date.now() - started > 60000) {
          const link = connection();
          const what = run.action === 'menu' ? run.menu.join(' › ') : run.action;
          if (['slow', 'offline'].includes(link) && Date.now() - started < 300000) {
            setPhase(`RStudio is still waiting for an answer about ${what}. The connection may be slow…`);
          } else if (link !== 'ok') {
            throw new SlowConnection(`RStudio didn't show the result of ${what}. The connection may be slow.`);
          } else {
            throw new Error(`RStudio didn't show the result of ${what}.`);
          }
        }
        await sleep(200);
      }
      Object.assign(state.values, run.expected_values || {});
      say(run.ide?.restarted ? 'R restarted: the Console shows a fresh session and the Environment is empty'
        : run.ide && 'pref' in run.ide ? 'RStudio saved the setting'
        : run.evidence === 'file' ? `RStudio wrote ${run.path}` : 'Done');
      await heed(dwellMs);
    }

    async function menuPath(path) {
      if (!(await clickOn(() => ide.menubar(path[0]), `menu ${path[0]}`))) throw new Error(`The ${path[0]} menu is not visible.`);
      for (let k = 1; k < path.length; k += 1) {
        const re = new RegExp(`^${path[k].replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/(…|\\\.\\\.\\\.)$/, '')}`);
        if (!(await waitFor(() => ide.menuItem(re), 5000))) throw new Error(`The ${path.slice(0, k).join(' › ')} menu has no ${path[k]} item.`);
        await clickOn(() => ide.menuItem(re), `menu ${path[k]}`, {lone: k < path.length - 1});
      }
    }

    // File › New Project… › New Directory › New Project, the directory name typed one key at a time,
    // then Create Project. RStudio then reloads the page into the new project (S7), which ends this
    // script: whoever called this records beforehand what to do after the reload. RStudio first asks
    // about documents with unsaved changes, and the coach saves them: "Unsaved Changes" with Save
    // for one document, "The following 2 files have unsaved changes" with Save Selected (all ticked)
    // for several. A folder of that name may be left from before; RStudio opens it as the project
    // all the same.
    async function newProject(run, purpose) {
      say(`${purpose}: File › New Project…`);
      await menuPath(['File', 'New Project…']);
      const wizard = () => ide.dialog(/New Project Wizard/);
      const unsavedAsk = () => !wizard() && ide.dialog(/unsaved changes/i);
      const saveAll = () => unsavedAsk() && (ide.dialogButton(unsavedAsk(), 'Save') || ide.dialogButton(unsavedAsk(), 'Save Selected'));
      if (!(await waitFor(() => wizard() || unsavedAsk(), 10000))) throw new Error('The New Project wizard did not open.');
      if (unsavedAsk()) {
        say('RStudio asks whether to save your changes before it leaves this project: pressing **Save**');
        if (!(await clickOn(saveAll, 'dialog Save'))) throw new Error('RStudio\'s question about unsaved changes has no Save button.');
        if (!(await waitFor(wizard, 10000))) throw new Error('The New Project wizard did not open.');
      }
      for (const choice of ['New Directory', 'New Project']) {
        if (!(await waitFor(() => ide.leaf(wizard(), choice), 10000))) throw new Error(`The New Project wizard has no ${choice}.`);
        await clickOn(() => ide.leaf(wizard(), choice), `wizard ${choice}`);
        await pause(400);
      }
      const input = () => wizard() && (wizard().querySelector('#rstudio_new_project_directory_name') || [...wizard().querySelectorAll('input[type="text"]')].find(shown));
      if (!(await waitFor(input, 10000))) throw new Error('The New Project wizard has no box for the directory name.');
      await clickOn(input, 'wizard directory name');
      say(`Naming the project ${run.name}`);
      const box = input();
      box.focus();
      box.value = '';
      for (const c of run.name) {
        await pause(keyGap(run.name, 0));
        box.value += c;
        box.dispatchEvent(new Event('input', {bubbles: true}));
        box.dispatchEvent(new KeyboardEvent('keyup', {bubbles: true, key: c}));
        state.actions += 1;
      }
      box.dispatchEvent(new Event('change', {bubbles: true}));
      await heed(400);
      const create = () => wizard() && ide.dialogButton(wizard(), 'Create Project');
      if (!(await clickOn(create, 'wizard Create Project'))) throw new Error('The wizard\'s Create Project button is not visible.');
      note('demo_action', {action: 'new-project', name: run.name});
      // The page reloads into the new project, ending this. Anything else is RStudio objecting.
      for (const t = Date.now(); Date.now() - t < 60000; await sleep(500)) {
        const objection = [...document.querySelectorAll('.gwt-DialogBox, [role="dialog"], [role="alertdialog"]')].find(d => shown(d) && !/New Project Wizard/.test(d.textContent));
        if (objection) throw new Error(`RStudio didn't create the project: ${normalise(objection.innerText).slice(0, 200)}`);
      }
      throw new Error('RStudio did not open the new project within a minute.');
    }

    async function setOption(run) {
      await menuPath(['Tools', 'Global Options']);
      const dialog = () => ide.dialog(/General|Restore \.RData/) && [...document.querySelectorAll('.gwt-DialogBox, [role="dialog"]')]
        .find(d => shown(d) && ide.dialogButton(d, 'OK') && ide.dialogButton(d, 'Cancel') && /Options/.test(d.querySelector('.gwt-Caption, [class*="Caption"], h1, h2')?.textContent || d.textContent.slice(0, 80)));
      if (!(await waitFor(dialog, 10000))) throw new Error('The Global Options dialog did not open.');
      // RStudio's labels sometimes end in a colon ("Restore .RData into workspace at startup:").
      const plain = text => text.replace(/\s+/g, ' ').trim().replace(/:$/, '');
      const label = () => [...(dialog()?.querySelectorAll('label') || [])].find(l => shown(l) && plain(l.textContent) === plain(run.label));
      try {
        await setIn(run, dialog, label);
      } catch (error) {
        const cancel = ide.dialogButton(dialog(), 'Cancel');
        if (cancel) press(cancel); // leave RStudio as it was
        throw error;
      }
    }
    async function setIn(run, dialog, label) {
      if (!label()) {
        const pane = () => [...(dialog()?.querySelectorAll('*') || [])].find(el => el.childElementCount === 0 && shown(el) && el.textContent.trim() === run.pane);
        if (!(await clickOn(pane, `options ${run.pane}`))) throw new Error(`Global Options has no ${run.pane} pane.`);
        if (!(await waitFor(label, 5000))) throw new Error(`Global Options › ${run.pane} has no setting "${run.label}".`);
      }
      const box = () => {
        const l = label();
        return l && (l.htmlFor ? document.getElementById(l.htmlFor) : l.parentElement.querySelector('input[type="checkbox"]'));
      };
      if (box() && box().checked !== run.value) {
        await clickOn(label, `option ${run.label}`);
        if (box().checked !== run.value) box().click(); // GWT sometimes ignores a synthetic click on the label
        if (box().checked !== run.value) throw new Error(`The coach couldn't set "${run.label}".`);
      }
      await pause(300);
      if (!(await clickOn(() => ide.dialogButton(dialog(), 'OK'), 'options OK'))) throw new Error('The OK button of Global Options is not visible.');
      await waitFor(() => !dialog(), 5000);
    }

    return {openScript, doRun, doAction, plotHistory};
  }

  // ---------- Guided and Solo: the learner works RStudio ----------
  // These lessons have no hidden answer (their code and reference output are public), so the
  // coach can confirm a line in the page: by what RStudio shows, not by how the line was typed.
  // A line counts when, after the mode started, the Console shows it ran without an error and
  // printed the reference output. A line that prints nothing (an assignment, a chart) counts
  // when the command matches the reference, ignoring spaces, comments, quote style and = for <-,
  // and a chart line also needs a new chart in the Plots pane. The Console and Script both work.
  function consoleWatch(settle) {
    let from = null; // index of the first Console entry made in this mode
    let count = 0;
    let lastPlot = null;
    const plots = []; // each chart RStudio loaded, with how many Console entries existed then
    const watch = {
      poll() {
        const now = Date.now();
        const current = sampleConsole();
        const changedAt = consoleClock.changedAt;
        const entries = consoleEntries(current);
        if (entries.length < count) { // the learner cleared the Console (Ctrl+L)
          if (from !== null) from = 0;
          for (const p of plots) p.after = 0;
        }
        count = entries.length;
        const img = ide.plotImage();
        const src = img && img.complete && img.naturalWidth > 0 ? img.src : null;
        if (src && src !== lastPlot) { lastPlot = src; plots.push({src, after: entries.length}); }
        // A mode the learner chooses counts from that moment. A mode reopened by a reload waits
        // until RStudio has refilled the Console with earlier output, which is not new work.
        if (from === null) {
          if (settle && (!document.getElementById('rstudio_console_input') || now - changedAt < 1000)) return null;
          from = entries.length;
        }
        return {entries, from, plots, quietMs: now - changedAt};
      },
    };
    watch.poll();
    return watch;
  }
  function matchRun(run, view, from = view.from) {
    const wantOutput = Boolean(run.expected_output.trim());
    for (let k = view.entries.length - 1; k >= from; k -= 1) {
      const entry = view.entries[k];
      if (!codeKey(entry.code) || consoleError(entry.output)) continue;
      if (wantOutput ? !sameTokens(entry.output, run.expected_output) : codeKey(entry.code) !== codeKey(run.code)) continue;
      if (run.evidence === 'plot' && !view.plots.some(p => p.after > k)) continue;
      return {index: k, output: entry.output};
    }
    return null;
  }
  // Values a line printed, read the same way as in Demonstration.
  function captured(run, output) {
    const values = {};
    for (const [name, pattern] of Object.entries(run.capture || {})) {
      values[name] = (new RegExp(pattern).exec(normalise(output || '')) || [])[1] ?? run.expected_values[name];
    }
    return values;
  }
  const expectedValues = steps => Object.assign({}, ...steps.flatMap(s => s.runs.map(r => r.expected_values || {})));

  function renderGuided({content, session, lesson, status, restored, storeKey: keyFor, switchLabel, changeMode, finish, next}) {
    const steps = lesson.steps;
    const script = lesson.script;
    const key = (s, r) => `${s}.${r}`;
    const storeKey = keyFor('Guided');
    // done: {"step.line": "learner" | "coach"}; hints: {"step.line": hints read}.
    // since: the first Console entry that gets feedback for this step (undefined: the mode's first).
    // mark: where R's evidence stood when the mode began; claims: the calls (or Console entries)
    // already credited to a statement, so one result never ticks two.
    const g = (coach.guided = {step: 0, done: {}, hints: {}, values: {}, showing: false, show: null, feedback: '', since: undefined, mark: null, claims: [], off: {}, conflicts: null});
    try {
      const saved = JSON.parse(sessionStorage.getItem(storeKey) || 'null');
      if (saved) Object.assign(g, {step: Math.min(saved.step || 0, steps.length - 1), done: saved.done || {}, hints: saved.hints || {}, values: saved.values || {}, mark: saved.mark || null, claims: saved.claims || [], off: saved.off || {}, conflicts: saved.conflicts ?? null});
    } catch (_error) { /* storage blocked */ }
    const persist = () => {
      try { sessionStorage.setItem(storeKey, JSON.stringify({step: g.step, done: g.done, hints: g.hints, values: g.values, mark: g.mark, claims: g.claims, off: g.off, conflicts: g.conflicts})); } catch (_error) { /* storage blocked */ }
    };
    const stepDone = s => steps[s].runs.every((_run, r) => g.done[key(s, r)]);
    const current = () => steps[g.step].runs.findIndex((_run, r) => !g.done[key(g.step, r)]); // -1: step done
    const finished = () => g.step === steps.length - 1 && stepDone(g.step);

    // The current step's card comes first, so its task is in view; what the lesson covers, and its
    // steps, fold away below the buttons.
    content.innerHTML = `
      <h2>${escapeHtml(lesson.title)}</h2>
      <p class="howto">${inline(`Write each ${unitOf(lesson) === 'task' ? 'statement' : 'line'} under its step heading in \`${script}\`, then press **Ctrl+Enter** to run it. The coach ticks each ${unitOf(lesson)} when R shows the right result.`)}</p>
      <section class="card">
        <h3></h3>
        <p class="task-count" aria-live="polite"></p>
        <ol class="tasks"></ol>
        <div class="hints"></div>
        <p class="feedback" aria-live="polite"></p>
        <p class="phase" aria-live="polite"></p>
        <div class="explain" aria-live="polite"></div>
      </section>
      <section class="card debrief" hidden aria-live="polite"></section>
      <div class="row">
        <button class="hint">Hint</button>
        <button class="show">Show me</button>
        <button class="primary next" hidden>Next step</button>
        <button class="switch">${switchLabel}</button>
      </div>
      <details class="steps-box about"><summary>About this lesson</summary>
        <div class="overview">
          <div class="intro prose">${format(lesson.summary, {})}</div>
          ${stepList(steps)}
          ${sourceLine(lesson)}
        </div>
      </details>`;
    const $ = sel => content.querySelector(sel);
    const hintBtn = $('.hint');
    const showBtn = $('.show');
    const nextBtn = $('.next');
    const setPhase = phaseSetter($('.phase'));

    function hintsFor(s, r) {
      const step = steps[s];
      const run = step.runs[r];
      if (run.action === 'type') return [escapeHtml(run.hint_where), `It starts like this: ${codeHtml(run.hint_partial)}`, `Add exactly this: ${codeHtml(run.hint_line)}`];
      if (run.action) return [escapeHtml(run.hint_where), escapeHtml(run.hint_how)];
      const several = run.code.includes('\n');
      return [
        `Write it on a new line under <code>${escapeHtml(step.heading)}</code> in ${escapeHtml(script)}. Then press <strong>Ctrl+Enter</strong>${/\.qmd$/.test(script) ? ', or choose <strong>Run › Run Selected Line(s)</strong>' : ', or click <strong>Run</strong>'}.` +
          (several && /[([{]\n/.test(run.code) ? ' When you press Enter between brackets, RStudio moves the closing bracket down a line for you. So don\'t type it twice.' : ''),
        blanksHint(run),
        `The whole ${several ? 'statement' : 'line'} is ${codeHtml(run.hint_line)}` + keysHint(run),
      ].filter(Boolean);
    }

    function render() {
      for (const li of content.querySelectorAll('li[data-step]')) {
        const s = Number(li.dataset.step);
        li.className = stepDone(s) ? 'done' : s === g.step ? 'active' : '';
      }
      const step = steps[g.step];
      const r = current();
      $('.card h3').innerHTML = `Step ${g.step + 1} of ${steps.length}: ${linkedTitle(step.title)}`;
      // A step with several tasks says which one is current, so that finishing one task (by Show me,
      // say) visibly moves on to the next while the step stays the same.
      const many = step.runs.length > 1;
      const doneCount = step.runs.filter((_run, k) => g.done[key(g.step, k)]).length;
      const count = !many || r < 0 ? ''
        : doneCount ? `${doneCount} of ${step.runs.length} tasks done. Now task ${r + 1}.`
        : `This step has ${step.runs.length} tasks. Start with task 1.`;
      const countEl = $('.task-count');
      if (countEl.textContent !== count) {
        countEl.textContent = count;
        countEl.classList.remove('new');
        if (count && doneCount) { void countEl.offsetWidth; countEl.classList.add('new'); }
      }
      $('.tasks').innerHTML = step.runs.map((run, k) =>
        `<li class="${g.done[key(g.step, k)] ? 'done' : k === r ? 'active' : ''}">${many ? `<span class="task-num">Task ${k + 1}.</span> ` : ''}${inline(run.task)}${chartTaskNote(lesson, g.step, k)}</li>`).join('');
      const read = r < 0 ? 0 : g.hints[key(g.step, r)] || 0;
      const hints = r < 0 ? [] : hintsFor(g.step, r);
      $('.hints').innerHTML = hints.slice(0, read).map(h => `<p class="hint-text">${h}</p>`).join('');
      // Feedback that ends in {help} suggests a hint while any are left, and Show me after that.
      const said = r < 0 || g.showing ? '' : g.feedback.replace(/\{help\}$/, read < hints.length ? ', or ask for a hint.' : '. Compare it with the last hint, or press Show me.');
      $('.feedback').innerHTML = said ? inline(said) : '';
      // The wrong name, linked between R's message and the code, while the feedback is about it.
      if (said && g.why?.name) linkName(g.why.name, g.why.code); else linkName(null);
      $('.explain').innerHTML = r < 0 ? explainHtml(step, {...expectedValues(steps), ...g.values}, g.conflicts) : '';
      hintBtn.hidden = showBtn.hidden = r < 0;
      hintBtn.disabled = g.showing || read >= hints.length;
      const which = many && r >= 0 ? ` for task ${r + 1}` : '';
      hintBtn.textContent = read >= hints.length ? 'No more hints' : `Hint ${read + 1} of ${hints.length}${which}`;
      showBtn.textContent = g.showing ? 'Stop' : many && r >= 0 ? `Show me task ${r + 1}` : 'Show me';
      nextBtn.hidden = r >= 0 || finished();
      nextBtn.textContent = `Next: step ${g.step + 2}`;
      const debrief = $('.debrief');
      debrief.hidden = !finished();
      if (finished()) {
        const keys = steps.flatMap((s, i) => s.runs.map((_run, k) => key(i, k)));
        const own = steps.filter((s, i) => s.runs.every((_run, k) => g.done[key(i, k)] === 'learner' && !g.hints[key(i, k)])).length;
        const hints = keys.reduce((n, k) => n + (g.hints[k] || 0), 0);
        const shown = keys.filter(k => g.done[k] === 'coach').length;
        debrief.innerHTML = `<h3>All ${steps.length} steps done</h3>
          <ul class="stats">
            <li>Steps done without help: <strong>${own} of ${steps.length}</strong></li>
            <li>Hints read: <strong>${hints}</strong></li>
            <li>${unitOf(lesson) === 'task' ? 'Tasks' : 'Lines'} the coach showed you: <strong>${shown}</strong></li>
          </ul>
          <p class="muted">To practise without the step-by-step checks, change mode to Solo.</p>
          ${next ? `<div class="row"><button class="primary next-lesson">${escapeHtml(next.label)}</button></div>` : ''}`;
        debrief.querySelector('.next-lesson')?.addEventListener('click', () => next.go());
        status(`Guided lesson complete · ${lesson.title}`);
        finish?.();
      }
    }

    // What the newest library(tidyverse) in the Console printed, for the note in the explanation.
    function tidyverseOutput() {
      const view = watch.poll();
      if (!view) return null;
      for (let k = view.entries.length - 1; k >= view.from; k -= 1) {
        if (/^library\((["']?)tidyverse\1\)/.test(codeKey(view.entries[k].code))) return view.entries[k].output;
      }
      return null;
    }

    function complete(s, r, by, output, claim = null) {
      const k = key(s, r);
      if (g.done[k]) return;
      if (attachesTidyverse(steps[s].runs[r])) g.conflicts = showedConflicts(typeof output === 'string' && output ? output : tidyverseOutput());
      Object.assign(g.values, captured(steps[s].runs[r], output));
      g.done[k] = by;
      if (claim) g.claims.push(claim);
      g.feedback = '';
      if (lesson.version === 2) g.since = entriesNow() ?? g.since; // what ran before this tick needs no feedback
      persist();
      note('guided_line_done', {step: steps[s].id, line: r, by});
      if (stepDone(s)) note('guided_step_done', {step: steps[s].id});
      render();
    }

    // What to tell the learner about the last thing they ran for this step, if it didn't count.
    // null: they haven't run anything since the step started, so keep what the card says.
    // `diagnosis`: what the coach could tell about it (explainError and the like), for the link.
    let diagnosis = null;
    function feedbackFor(view) {
      diagnosis = null;
      const from = Math.max(view.from, g.since ?? view.from);
      for (let k = view.entries.length - 1; k >= from; k -= 1) {
        const entry = view.entries[k];
        if (!codeKey(entry.code)) {
          // The last thing run was an empty line, or only a comment: Run with the cursor on a blank
          // line sends that line, or jumps ahead to the next heading. Say so once R is quiet.
          if (k === view.entries.length - 1 && !entry.output.trim() && view.quietMs >= 1500) {
            return entry.code.trim()
              ? 'Only a comment ran. Click in your code, then press Ctrl+Enter.'
              : 'Nothing ran: the cursor was on an empty line. Click in your code, then press Ctrl+Enter.';
          }
          continue; // a comment, such as a step heading Run sent along
        }
        const error = consoleError(entry.output);
        const wanted = steps[g.step].runs[current()];
        if (error && !(wanted?.evidence === 'error')) {
          // The whole output: a tidyverse error's cause comes after lines consoleError leaves out.
          diagnosis = explainError(entry.output, entry.code, lesson);
          if (diagnosis) diagnosis.code = entry.code;
          return `R reported: ${error.replace(/\.$/, '')}. ${diagnosis ? diagnosis.text : 'Fix the line, then run it again.'}`;
        }
        if (lesson.version !== 2 && steps.some(step => step.runs.some(run => matchRun(run, view, k)?.index === k))) return '';
        if (view.quietMs < 2500) return g.feedback; // a chart may still be loading, or R's evidence arriving
        // Not "wrong" until R's record has been read from after the Console went quiet (R writes it
        // within about 2 s): on a slow connection that reading can lag well behind the Console.
        if (lesson.version === 2 && (evidence.at < consoleClock.changedAt + 2000 || ['slow', 'offline'].includes(connection()))) return g.feedback;
        if (wanted?.keysMissing) {
          const {token, name} = SHORTCUTS[wanted.keys];
          return `That's the right result. This task also asks you to type ${name}, ${token}, with ${wanted.keys}: press it once where the ${token} goes, then run the statement again.`;
        }
        const ran = entry.code.trim().split('\n')[0] + (entry.code.trim().includes('\n') ? ' …' : '');
        // Why, where the coach can tell: a warning that changed the result, or the first difference
        // from the task's code.
        diagnosis = explainWarning(entry.output, lesson) || explainDifference(entry.code, wanted);
        if (diagnosis) {
          diagnosis.code = entry.code;
          return `RStudio ran \`${ran}\`, but R's result isn't what this task asks for. ${diagnosis.text}`;
        }
        return lesson.version === 2 ? `RStudio ran \`${ran}\`, but R's result isn't what this task asks for. Check the task{help}`
          : `RStudio ran ${ran}, but that isn't what this line asks for. Check the task{help}`;
      }
      return null;
    }

    const watch = consoleWatch(restored);
    const entriesNow = () => watch.poll()?.entries.length ?? null; // null: Console not settled yet
    // Statements count from the mode's start: a fresh mode marks where R's evidence stands now.
    if (!g.mark) evidenceMark().then(mark => { g.mark = mark; noteIdeOff(lesson, evidence.doc || EMPTY_EVIDENCE, mark, g.off); persist(); });
    let polling = false;
    let ended = false;
    const timer = setInterval(async () => {
      if (polling) return;
      polling = true;
      try {
        const view = watch.poll();
        if (!view) return;
        const doc = lesson.version === 2 ? await readEvidence() : null;
        if (ended) return;
        if (doc && g.mark) noteIdeOff(lesson, doc, g.mark, g.off);
        if (g.since === null) g.since = view.entries.length;
        const s = g.step;
        for (const [r, run] of steps[s].runs.entries()) {
          if (g.done[key(s, r)]) continue;
          const match = runDone(run, view, doc, g.mark, new Set(g.claims), g.off);
          // Only the task Show me is doing counts as the coach's: the learner may move on and run the
          // next one while the coach is still at work. So does a Show me the connection cut short,
          // if R's result arrives within 5 minutes.
          const shown = (g.showing && g.show?.k === key(s, r)) || (g.late?.k === key(s, r) && Date.now() < g.late.until);
          if (match && view.quietMs >= 600) complete(s, r, shown ? 'coach' : 'learner', match.output, match.key);
        }
        if (g.showing || current() < 0) return;
        const feedback = feedbackFor(view);
        if (feedback !== null && feedback !== g.feedback) { g.feedback = feedback; g.why = diagnosis; render(); }
      } finally {
        polling = false;
      }
    }, 300);

    hintBtn.addEventListener('click', () => {
      const r = current();
      if (r < 0 || g.showing) return;
      const k = key(g.step, r);
      const run = steps[g.step].runs[r];
      g.hints[k] = Math.min(hintsFor(g.step, r).length, (g.hints[k] || 0) + 1);
      if (g.hints[k] === 1) highlight(run.action ? actionControl(run) : ide.source(), 4000);
      persist();
      note('hint', {step: steps[g.step].id, line: r, level: g.hints[k]});
      render();
    });
    showBtn.addEventListener('click', async () => {
      if (g.showing) { g.show.stopped = true; return; }
      const r = current();
      if (r < 0) return;
      const s = g.step;
      const step = steps[s];
      g.showing = true;
      g.feedback = '';
      g.show = {stopped: false, actions: 0, values: {}, k: key(s, r)};
      pointerFrom(showBtn);
      render();
      note('show_me', {step: step.id, line: r});
      const drive = makeDriver(lesson, g.show, setPhase);
      const run = step.runs[r];
      try {
        let output = '';
        if (run.action) {
          await drive.doAction(run, step, s);
        } else {
          await drive.openScript();
          output = await drive.doRun(run, step, s);
        }
        // The coach's result is the one that counts for this statement.
        const doc = lesson.version === 2 ? await readEvidence(0) : null;
        const match = runDone(run, watch.poll() || {entries: [], from: 0, plots: []}, doc, g.mark, new Set(g.claims), null);
        complete(s, r, 'coach', output, match?.key);
      } catch (error) {
        if (error instanceof SlowConnection && !ended) {
          g.late = {k: key(s, r), until: Date.now() + 300000};
          g.feedback = `${error.message} The code is in the script. If R's result arrives, the coach ticks this task. You can also press Show me again.`;
          g.since = entriesNow();
          note('show_me_slow', {step: step.id, reason: error.message});
        } else if (!(error instanceof DemoStopped) && !ended) {
          g.feedback = `The coach couldn't show this ${run.action ? 'step' : 'line'}. ${error.message}`;
          g.since = entriesNow(); // keep this message until the learner runs something new
          note('show_me_failed', {step: step.id, reason: error.message});
        }
      } finally {
        g.showing = false;
        showPointer(false);
        spotlight(null);
        clearHighlight();
        setPhase('');
        if (!ended) render(); // the learner may have left Guided while the coach was still at work
      }
    });
    nextBtn.addEventListener('click', () => {
      if (current() >= 0 || g.step >= steps.length - 1) return;
      g.step += 1;
      g.since = entriesNow(); // only what the learner runs from now on gets feedback for this step
      g.feedback = '';
      persist();
      note('guided_step_started', {step: steps[g.step].id});
      render();
    });
    $('.switch').addEventListener('click', () => changeMode());

    render();
    return () => {
      ended = true;
      clearInterval(timer);
      if (g.show) g.show.stopped = true;
      showPointer(false);
      spotlight(null);
      clearHighlight();
      linkName(null);
      coach.guided = null;
    };
  }

  function renderSolo({content, session, lesson, status, restored, storeKey: keyFor, switchLabel, changeMode, finish, next}) {
    const steps = lesson.steps;
    const lines = steps.flatMap((step, s) => step.runs.map((run, r) => ({k: `${s}.${r}`, run})));
    const unit = unitOf(lesson);
    const storeKey = keyFor('Solo');
    // seen: lines RStudio showed with the reference result (kept quiet until a check);
    // checked: what the last check disclosed.
    // mark and claims: as in Guided.
    const solo = (coach.solo = {seen: {}, hints: {}, values: {}, checked: null, mark: null, claims: [], off: {}});
    try {
      const saved = JSON.parse(sessionStorage.getItem(storeKey) || 'null');
      if (saved) Object.assign(solo, {seen: saved.seen || {}, hints: saved.hints || {}, values: saved.values || {}, checked: saved.checked || null, mark: saved.mark || null, claims: saved.claims || [], off: saved.off || {}});
    } catch (_error) { /* storage blocked */ }
    const persist = () => {
      try { sessionStorage.setItem(storeKey, JSON.stringify(solo)); } catch (_error) { /* storage blocked */ }
    };

    content.innerHTML = `
      ${lessonHeader(lesson, `Work through the list on your own in \`${lesson.script}\`. Write each ${lesson.version === 2 ? 'statement' : 'line'} under its step heading and run it. The coach checks nothing until you press **Check my work**.`)}
      ${sourceLine(lesson)}
      <ol class="solo-steps">${steps.map((step, s) => `
        <li><strong>${linkedTitle(step.title)}</strong>
          <ul class="tasks">${step.runs.map((run, r) => `
            <li data-line="${s}.${r}">${inline(run.task)}${chartTaskNote(lesson, s, r)}
              <button class="link hint" data-line="${s}.${r}" title="Hints are counted in your results">Hint</button>
              <span class="hint-text"></span>${attachesTidyverse(run) ? CONFLICTS_NOTE_SHORT : ''}</li>`).join('')}
          </ul></li>`).join('')}
      </ol>
      <div class="row">
        <button class="primary check">Check my work</button>
        <button class="switch">${switchLabel}</button>
      </div>
      <section class="card results" hidden aria-live="polite"></section>`;
    const $ = sel => content.querySelector(sel);

    function render() {
      for (const li of content.querySelectorAll('li[data-line]')) {
        const k = li.dataset.line;
        const [s, r] = k.split('.').map(Number);
        li.className = solo.checked ? (solo.checked.seen[k] ? 'done' : 'missing') : '';
        li.querySelector('.hint').hidden = Boolean(solo.hints[k]);
        const run = steps[s].runs[r];
        li.querySelector('.hint-text').innerHTML = !solo.hints[k] ? '' : run.action === 'type' ? `It starts like this: ${codeHtml(run.hint_partial)}` : run.action ? escapeHtml(run.hint_how)
          : blanksHint(run) || `It's ${codeHtml(run.hint_line)}` + keysHint(run);
      }
      const results = $('.results');
      results.hidden = !solo.checked;
      if (!solo.checked) return;
      const done = lines.filter(l => solo.checked.seen[l.k]).length;
      const hints = Object.keys(solo.hints).length;
      $('.check').textContent = 'Check again';
      if (done === lines.length) {
        const values = {...expectedValues(steps), ...solo.values};
        results.innerHTML = `<h3>All ${lines.length} ${unit}s done</h3>
          <p>Every ${unit} gave the right result in R. Hints used: <strong>${hints}</strong>.</p>
          <details><summary>What each step showed</summary>
            <div class="prose">${steps.map(step => `<h4>${linkedTitle(step.title)}</h4>${explainHtml(step, values)}`).join('')}</div>
          </details>
          ${next ? `<div class="row"><button class="primary next-lesson">${escapeHtml(next.label)}</button></div>` : ''}`;
        results.querySelector('.next-lesson')?.addEventListener('click', () => next.go());
        status(`Solo lesson complete · ${lesson.title}`);
        finish?.();
      } else {
        results.innerHTML = `<h3>${done} of ${lines.length} ${unit}s done</h3>
          <p>The ticked ${unit}s gave the right result in R. ${unit === 'task' ? 'Do' : 'Run'} the others, then check again. Hints used: <strong>${hints}</strong>.</p>`;
      }
    }

    const watch = consoleWatch(restored);
    if (!solo.mark) evidenceMark().then(mark => { solo.mark = mark; noteIdeOff(lesson, evidence.doc || EMPTY_EVIDENCE, mark, solo.off); persist(); });
    let polling = false;
    let ended = false;
    const timer = setInterval(async () => {
      if (polling) return;
      polling = true;
      try {
        const view = watch.poll();
        if (!view || view.quietMs < 600) return;
        const doc = lesson.version === 2 ? await readEvidence() : null;
        if (ended) return;
        if (doc && solo.mark) noteIdeOff(lesson, doc, solo.mark, solo.off);
        let changed = false;
        // In lesson order, so an earlier statement gets the first claim on a result.
        for (const {k, run} of lines) {
          if (solo.seen[k]) continue;
          const match = runDone(run, view, doc, solo.mark, new Set(solo.claims), solo.off);
          if (!match) continue;
          solo.seen[k] = true;
          if (match.key) solo.claims.push(match.key);
          Object.assign(solo.values, captured(run, match.output));
          changed = true;
          note('solo_line_seen', {line: k}); // recorded, not shown until the learner checks
        }
        if (changed) persist();
      } finally {
        polling = false;
      }
    }, 300);

    for (const button of content.querySelectorAll('button.hint')) {
      button.addEventListener('click', () => {
        solo.hints[button.dataset.line] = true;
        persist();
        note('hint', {line: button.dataset.line, mode: 'solo'});
        render();
      });
    }
    $('.check').addEventListener('click', () => {
      solo.checked = {seen: {...solo.seen}, at: Date.now()};
      persist();
      note('solo_check', {done: Object.keys(solo.seen).length, of: lines.length, hints: Object.keys(solo.hints).length});
      render();
    });
    $('.switch').addEventListener('click', () => changeMode());

    render();
    return () => { ended = true; clearInterval(timer); coach.solo = null; };
  }

  // ---------- helpers ----------
  // The Source editor's rows first..last, across the editor (line numbers included).
  function editorRowsRect(editor, first, last) {
    const renderer = editor.renderer;
    const box = renderer.scroller.getBoundingClientRect();
    const top = clamp(renderer.textToScreenCoordinates(first, 0).pageY, box.top, box.bottom);
    const bottom = clamp(renderer.textToScreenCoordinates(last, 0).pageY + renderer.lineHeight, box.top, box.bottom);
    return bottom > top ? {left: editor.container.getBoundingClientRect().left, top, right: box.right, bottom} : null;
  }
  // The Console lines from character `from` of its text to the end, across the pane: one command
  // and what it printed. Clipped to the visible part of the Console.
  function consoleRangeRect(from) {
    const out = document.getElementById('rstudio_console_output');
    const pane = ide.console();
    if (!out || !pane || from < 0) return null;
    const end = out.textContent.trimEnd().length;
    const walker = document.createTreeWalker(out, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    let pos = 0;
    let started = false;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const len = node.nodeValue.length;
      if (!started && pos + len > from) { range.setStart(node, from - pos); started = true; }
      if (started && pos + len >= end) { range.setEnd(node, end - pos); break; }
      pos += len;
    }
    if (!started) return null;
    const r = range.getBoundingClientRect();
    let scroller = out.parentElement;
    while (scroller && scroller !== pane && !/auto|scroll/.test(getComputedStyle(scroller).overflowY)) scroller = scroller.parentElement;
    const box = (scroller || pane).getBoundingClientRect();
    const p = pane.getBoundingClientRect();
    const top = Math.max(r.top, box.top, p.top);
    const bottom = Math.min(r.bottom, box.bottom, p.bottom);
    return bottom > top ? {left: p.left + 4, top, right: p.right - 4, bottom} : null;
  }
  // The Environment pane's row for a variable, across the pane.
  function environmentRowRect(name) {
    const pane = ide.environment();
    const cell = pane && [...pane.querySelectorAll('*')].find(el => el.childElementCount === 0 && el.textContent.trim() === name && shown(el));
    if (!cell) return null;
    const row = (cell.closest('tr') || cell).getBoundingClientRect();
    const p = pane.getBoundingClientRect();
    return {left: p.left + 4, top: row.top, right: p.right - 4, bottom: row.bottom};
  }
  // The row where `code` (all its lines) starts in a step's block, or -1.
  function findStatement(lines, block, code) {
    const want = code.split('\n');
    for (let r = block.start; r + want.length <= block.end; r += 1) {
      if (want.every((line, k) => lines[r + k].trimEnd() === line)) return r;
    }
    return -1;
  }
  // A step's code goes below its "# Step N." heading, up to the next heading. `last` is the
  // step's last non-blank line (the heading itself if nothing is typed yet).
  function stepBlock(lines, heading) {
    const at = lines.findIndex(line => line.trimEnd() === heading);
    if (at < 0) return null;
    let end = lines.findIndex((line, r) => r > at && /^(# Step \d+\. |```)/.test(line)); // in a .qmd, the chunk's fence
    if (end < 0) end = lines.length;
    let last = at;
    for (let r = at + 1; r < end; r += 1) if (lines[r].trim()) last = r;
    return {start: at + 1, end, last};
  }
  // Gaps between keystrokes vary the way a person's do: a little longer after a space, and a
  // short pause before starting a comment.
  function keyGap(code, i) {
    let ms = typeMs * (0.6 + Math.random() * 0.8);
    if (code[i - 1] === ' ') ms += typeMs * 0.5 * Math.random();
    if (code[i] === '#') ms += typeMs * 4;
    return ms;
  }
  const clamp = (value, low, high) => Math.min(Math.max(value, low), Math.max(low, high));
  // The Console as a list of commands and what each printed. RStudio echoes each command after
  // "> ", and continues one over several lines with "+ ".
  function consoleEntries(text) {
    const entries = [];
    let entry = null;
    for (const line of text.split('\n')) {
      if (line.startsWith('> ')) {
        entry = {code: line.slice(2), output: ''};
        entries.push(entry);
      } else if (entry && line.startsWith('+ ') && !entry.output) {
        entry.code += `\n${line.slice(2)}`;
      } else if (entry) {
        entry.output += `${line}\n`;
      }
    }
    return entries;
  }
  // RStudio puts its "Show Traceback / Rerun with Debug" links on the same line as the error,
  // and R continues a long message on an indented line.
  // Base R's errors continue on an indented line; the tidyverse's (rlang's) put the message on the
  // lines after "Error:" or "Error in `f()`:", starting with "! " and indented after that.
  function consoleError(output) {
    const m = /(?:^|\n|Rerun with Debug)\s*(Error\b[^\n]*(?:\n(?:! | {2}\S)[^\n]*)*)/.exec(output);
    return m ? normalise(m[1]) : null;
  }
  // ---------- What went wrong, in Guided ----------
  // Guided explains what R said, or why the result differs, in terms of the learner's own code: the
  // name R couldn't find and the closest one the lesson uses, the argument a function or ggplot2
  // didn't know, the function the task needs that the code doesn't call yet. Each diagnosis is
  // {text, name}: `name` is the word to link between R's message and the code (linkWord).
  function editDistance(a, b) {
    const row = Array.from({length: b.length + 1}, (_v, j) => j);
    for (let i = 1; i <= a.length; i += 1) {
      let diagonal = row[0];
      row[0] = i;
      for (let j = 1; j <= b.length; j += 1) {
        const above = row[j];
        row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
        diagonal = above;
      }
    }
    return row[b.length];
  }
  // The candidate nearest to `name`, if it is near enough to be a slip: at most one edit in three
  // characters (two for distance_dm and distance_km), never `name` itself.
  function closest(name, candidates) {
    let best = null;
    let bestDistance = Infinity;
    for (const candidate of new Set(candidates)) {
      if (!candidate || candidate === name) continue;
      const d = editDistance(name.toLowerCase(), candidate.toLowerCase());
      if (d < bestDistance) { best = candidate; bestDistance = d; }
    }
    return best && bestDistance <= Math.max(1, Math.floor(Math.min(name.length, best.length) / 3)) ? best : null;
  }
  // The parts of some R code, outside comments: function calls, argument names (name = value), other
  // names, quoted strings, and each named argument's value as written.
  function codeParts(code) {
    const parts = {calls: [], args: [], names: [], strings: [], values: {}};
    const token = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|#[^\n]*|(?<![\w.])([A-Za-z][\w.]*|\.[A-Za-z_][\w.]*)(\s*\()?(\s*=(?!=))?/g;
    for (const m of code.matchAll(token)) {
      if (m[1]) { parts.strings.push(m[1].slice(1, -1)); continue; }
      if (!m[2]) continue; // a comment
      if (m[3]) parts.calls.push(m[2]);
      else if (m[4]) {
        parts.args.push(m[2]);
        const value = /^\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[^,()\n]+)/.exec(code.slice(m.index + m[0].length));
        if (value) parts.values[m[2]] = codeKey(value[1].trim());
      } else parts.names.push(m[2]);
    }
    return parts;
  }
  // Every name the lesson's own code uses, for suggestions; and the names its statements assign.
  function lessonWords(lesson) {
    const all = {calls: [], args: [], names: [], strings: [], assigned: [], library: null};
    for (const run of lesson.steps.flatMap(step => step.runs)) {
      for (const code of [run.code, ...(run.alternatives || [])].filter(Boolean)) {
        const parts = codeParts(code);
        for (const key of ['calls', 'args', 'names', 'strings']) all[key].push(...parts[key]);
        const assigned = /^\s*([A-Za-z.][\w.]*)\s*(?:<-|=(?!=))/.exec(code);
        if (assigned) all.assigned.push(assigned[1]);
      }
      if (run.evidence === 'attached' && !all.library) all.library = run.code;
    }
    return all;
  }
  // ggplot2's aesthetics and the settings its layers take most often, for "Ignoring unknown …".
  const AESTHETICS = ['x', 'y', 'colour', 'color', 'fill', 'alpha', 'size', 'shape', 'linetype', 'linewidth', 'group',
    'label', 'weight', 'xmin', 'xmax', 'ymin', 'ymax', 'xend', 'yend', 'binwidth', 'bins', 'method', 'se', 'position', 'stat', 'width'];
  const quoteName = name => `\`${name}\``;
  // Why R's error happened, in the learner's terms, or null when the coach has nothing to add.
  function explainError(error, code, lesson) {
    const words = lessonWords(lesson);
    let m = /object '([^']+)' not found/.exec(error);
    if (m) {
      const name = m[1];
      if (words.assigned.includes(name)) {
        return {name, text: `${quoteName(name)} is made by an earlier statement in this lesson. Run that statement first, then this one.`};
      }
      const better = closest(name, [...words.names, ...words.args, ...words.assigned]);
      return {name, text: better ? `R can't find ${quoteName(name)}. Did you mean ${quoteName(better)}?`
        : `R can't find ${quoteName(name)}. Check how it's spelled in the task.`};
    }
    m = /could not find function "([^"]+)"/.exec(error);
    if (m) {
      const name = m[1];
      if (words.calls.includes(name) && words.library) {
        return {name, text: `${quoteName(`${name}()`)} comes from a package that isn't loaded. Run ${quoteName(words.library)} from step 1 first.`};
      }
      const better = closest(name, [...words.calls, ...Object.keys(FUNCTION_DOCS)]);
      return {name, text: better ? `R has no function called ${quoteName(`${name}()`)}. Did you mean ${quoteName(`${better}()`)}?`
        : `R has no function called ${quoteName(`${name}()`)}. Check how it's spelled in the task.`};
    }
    m = /there is no package called\s*[‘'"`]([^’'"`]+)/.exec(error);
    if (m) {
      const better = closest(m[1], [...words.names, ...Object.keys(PACKAGE_DOCS)]);
      return {name: m[1], text: better ? `There's no package called ${quoteName(m[1])}. Did you mean ${quoteName(better)}?`
        : `There's no package called ${quoteName(m[1])}. Check how it's spelled in the task.`};
    }
    m = /unused arguments? \(([A-Za-z.][\w.]*)\s*=/.exec(error);
    if (m) {
      const better = closest(m[1], [...words.args, ...AESTHETICS]);
      return {name: m[1], text: `${quoteName(m[1])} isn't an argument of this function.${better ? ` Did you mean ${quoteName(better)}?` : ''}`};
    }
    m = /Column `([^`]+)` doesn't exist/.exec(error);
    if (m) {
      const better = closest(m[1], [...words.names, ...words.args]);
      return {name: m[1], text: `The data has no column called ${quoteName(m[1])}.${better ? ` Did you mean ${quoteName(better)}?` : ''}`};
    }
    m = /[`'‘"]?([^\s`'’"]+?)[`'’"]? does not exist in current working directory/.exec(error); // readr's wording, old and new
    if (m) {
      const better = closest(m[1], words.strings);
      return {name: m[1], text: `There's no file ${quoteName(m[1])} in the project.${better ? ` Did you mean ${quoteName(better)}?` : ''}`};
    }
    m = /unexpected (symbol|string constant|numeric constant|'\)'|'\]'|'\}'|','|'='|input|'[^']*')(?: in "([^"]*)")?/.exec(error);
    if (m) {
      const near = (m[2] || '').split('\n').pop().slice(-30);
      const where = near ? ` R stopped reading at ${quoteName(near)}.` : '';
      return {name: null, text: /^'[)\]}]'$/.test(m[1])
        ? `R found a closing bracket it didn't expect: one too many, or something missing before it.${where}`
        : `R couldn't read the code.${where} Something is missing just before the end of that: often a comma, an operator such as + or |>, or a bracket.`};
    }
    if (/Cannot use `\+` with a single argument/.test(error)) {
      return {name: null, text: 'A line starts with +. In ggplot2, put each + at the end of the line before it.'};
    }
    return null;
  }
  // A warning that changed the result: ggplot2 skips a setting or an aesthetic it doesn't know (a
  // chart drawn with alphas = 0.3 is drawn with no transparency at all).
  function explainWarning(output, lesson) {
    const m = /Ignoring unknown (parameters|aesthetics):\s*`([^`]+)`/.exec(output);
    if (!m) return null;
    const words = lessonWords(lesson);
    const better = closest(m[2], [...words.args, ...AESTHETICS]);
    return {name: m[2], text: `ggplot2 ignored ${quoteName(m[2])}, because it isn't a ${m[1] === 'aesthetics' ? 'mapping' : 'setting'} it knows, so the chart was drawn without it.${better ? ` Did you mean ${quoteName(better)}?` : ''}`};
  }
  // No error, but not the task's result: the first difference from the task's code that holds for
  // every way the lesson accepts (its code and alternatives), so the coach never calls a right
  // choice wrong. A name close to one the task uses, then a function it needs, then an argument's
  // value, then an argument it sets.
  function explainDifference(code, run) {
    if (!run?.code) return null;
    const mine = codeParts(code);
    const ways = [run.code, ...(run.alternatives || [])].map(codeParts);
    const anyWay = key => ways.flatMap(w => w[key]);
    for (const name of [...mine.names, ...mine.args]) {
      if (anyWay('names').includes(name) || anyWay('args').includes(name) || anyWay('calls').includes(name)) continue;
      const better = closest(name, [...anyWay('names'), ...anyWay('args')]);
      if (better) return {name, text: `Check ${quoteName(name)}: did you mean ${quoteName(better)}?`};
    }
    for (const name of mine.calls) {
      if (anyWay('calls').includes(name)) continue;
      const better = closest(name, anyWay('calls'));
      if (better) return {name, text: `Check ${quoteName(`${name}()`)}: did you mean ${quoteName(`${better}()`)}?`};
    }
    const needed = ways[0].calls.find(name => ways.every(w => w.calls.includes(name)) && !mine.calls.includes(name));
    if (needed) return {name: null, text: `Your code doesn't use ${quoteName(`${needed}()`)} yet, and the task needs it.`};
    for (const [arg, value] of Object.entries(mine.values)) {
      const wanted = ways.map(w => w.values[arg]).filter(v => v !== undefined);
      if (wanted.length && !wanted.includes(value)) return {name: arg, text: `Check the value of ${quoteName(arg)}: the task asks for a different one.`};
    }
    const missing = Object.keys(ways[0].values).find(arg => ways.every(w => arg in w.values) && !(arg in mine.values));
    if (missing) return {name: null, text: `The task also sets ${quoteName(missing)}, and your code doesn't yet.`};
    return null;
  }

  // A command reduced to what it does: no spaces or comments, one quote style, and = read as <-
  // when it assigns a name, so `x = c(1,2)` and `x <- c(1, 2) # note` compare equal.
  function codeKey(code) {
    let out = '';
    let quote = null;
    for (let i = 0; i < code.length; i += 1) {
      const c = code[i];
      if (quote) {
        if (c === '\\') { out += c + (code[i + 1] || ''); i += 1; continue; }
        if (c === quote) { quote = null; out += '"'; continue; }
        out += c === '"' ? '\\"' : c;
        continue;
      }
      if (c === '"' || c === "'") { quote = c; out += '"'; continue; }
      if (c === '#') {
        const end = code.indexOf('\n', i);
        if (end < 0) break;
        i = end;
        continue;
      }
      if (!/\s/.test(c)) out += c;
    }
    return out.replace(/^([A-Za-z.][\w.]*)=(?!=)/, '$1<-');
  }
  // How RStudio's Console echoes a statement: "> " before its first line and "+ " before each other.
  const echoOf = code => `> ${code.split('\n').join('\n+ ')}`;
  function countEchoes(text, code) {
    const needle = echoOf(code);
    let count = 0;
    for (let at = text.indexOf(needle); at !== -1; at = text.indexOf(needle, at + needle.length)) count += 1;
    return count;
  }
  function normalise(text) { return text.split(/\s+/).filter(Boolean).join(' '); }
  function sameTokens(a, b) {
    const tokens = s => s.split(/\s+/).filter(Boolean).sort().join(' ');
    return tokens(a) === tokens(b);
  }
  // A wait of 3 s or more is for something RStudio does after a round trip (open a file, clear a
  // pane): while RStudio is still waiting on a slow connection, it goes on, up to 60 s longer.
  // Shorter waits only look whether something optional appears (a dialog), and keep their time.
  async function waitFor(fn, ms) {
    let deadline = Date.now() + ms;
    const cap = deadline + (ms >= 3000 ? 60000 : 0);
    for (;;) {
      const value = fn();
      if (value) return value;
      if (Date.now() > deadline) {
        if (Date.now() >= cap || !['slow', 'offline'].includes(connection())) return null;
        deadline = Math.min(cap, Date.now() + 1000);
      }
      await sleep(100);
    }
  }
  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  }
  // Lesson text, one line of it: `code` becomes <code>, **bold** <strong> and *italic* <em>.
  // Code spans are left alone, so `x * y` stays as it is.
  const docLink = (url, name, label) => `<a class="doc-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(label)}">${escapeHtml(name)}</a>`;
  const functionLink = name => (FUNCTION_DOCS[name] ? docLink(FUNCTION_DOCS[name], name, `Documentation for ${name}()`) : escapeHtml(name));
  const packageLink = name => docLink(PACKAGE_DOCS[name], name, `The ${name} package's documentation`);
  // One pass links both, so a link's own URL is never scanned again: a name followed by "(" is a
  // function; a package's name is a package (in prose, only if it isn't also an everyday word).
  // Not after "/" or ".": a path such as data/readr.csv isn't the package.
  const NAME = /(^|[^\w./])([A-Za-z][\w.]*)(?=(\()|[^\w.(]|$)/g;
  const linkNames = (text, {code = false} = {}) => text.replace(NAME, (match, before, name, call) => {
    if (call) return before + functionLink(name);
    if (name in PACKAGE_DOCS && (code || !PLAIN_WORDS.has(name))) return before + packageLink(name);
    return match;
  });
  const linkedTitle = text => linkNames(escapeHtml(text));
  const inline = text => escapeHtml(text).split(/(`[^`]+`)/).map(part => (/^`[^`]+`$/.test(part)
    ? `<code>${linkNames(part.slice(1, -1), {code: true})}</code>`
    : linkNames(part.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^\w*])\*([^*\s](?:[^*]*[^*\s])?)\*(?![\w*])/g, '$1<em>$2</em>')))).join('');
  // A whole text: a blank line starts a new paragraph, and lines starting "- " make a list.
  // {name} becomes a value RStudio displayed in this run.
  function format(text, values) {
    const fill = html => html.replace(/\{\{(\w+)\}\}|\{(\w+)\}/g, (_m, literal, name) => {
      if (literal !== undefined) return `{${literal}}`; // {{5}} shows {5}, as in a regular expression
      if (!(name in values)) throw new Error(`The explanation needs ${name}, which RStudio has not shown yet.`);
      return `<strong>${escapeHtml(values[name])}</strong>`;
    });
    const html = [];
    for (const block of text.trim().split(/\n[ \t]*\n/)) {
      let para = [];
      let items = [];
      const flush = () => {
        if (para.length) html.push(`<p>${fill(inline(para.join(' ')))}</p>`);
        if (items.length) html.push(`<ul>${items.map(item => `<li>${fill(inline(item))}</li>`).join('')}</ul>`);
        para = [];
        items = [];
      };
      for (const line of block.split('\n')) {
        const item = /^\s*- (.*)$/.exec(line);
        if (item) { if (para.length) flush(); items.push(item[1]); } else { if (items.length) flush(); para.push(line.trim()); }
      }
      flush();
    }
    return html.join('');
  }
  // What a learner reads, without the markup: for reading times.
  const readable = text => text.replace(/[`*]/g, '').trim();

  // When the Console's text last changed, sampled from page load (see consoleWatch).
  const consoleClock = {text: null, changedAt: Date.now()};
  function sampleConsole() {
    const text = ide.consoleText();
    if (text !== consoleClock.text) Object.assign(consoleClock, {text, changedAt: Date.now()});
    return text;
  }
  setInterval(sampleConsole, 250);

  const ideListeners = [];
  const onIdeChange = fn => ideListeners.push(fn);
  let pending = false;
  const changed = () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      place();
      for (const fn of ideListeners) fn();
    });
  };

  // RStudio (GWT) builds its layout after load and can re-render panes; re-mount and re-place as needed.
  const ensure = () => {
    if (!document.body) return;
    if (!coach.host) mount();
    place();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensure); else ensure();
  new MutationObserver(ensure).observe(document.documentElement, {childList: true});
  const startObserving = () => new MutationObserver(changed).observe(document.body, {childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class', 'aria-selected']});
  if (document.body) startObserving(); else document.addEventListener('DOMContentLoaded', startObserving);
  setInterval(ensure, 1000);
})();
