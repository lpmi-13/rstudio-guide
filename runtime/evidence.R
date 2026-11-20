# Evidence for the coach: what R did, recorded by R.
#
# The coach used to judge a learner's work by reading the Console's text, which breaks when a
# tibble prints fewer columns in a narrow Console and when equivalent code is written another way.
# This file gives it R's own view instead:
#
#   - after every successful top-level call (addTaskCallback), a fingerprint of the value it
#     returned, its class and shape, the name it assigned, if any, and the package a library() call
#     attached;
#   - every second while R is idle (later), a little state: attached packages, the working
#     directory, some RStudio preferences and the project's files with their modification times
#     (not data/, which holds the lessons' data).
#
# Both go to /home/rstudio/.lab/evidence.json, which the gateway serves to the coach. It holds
# fingerprints, classes, shapes and names, never data values or the learner's code.
#
# Loaded by Rprofile.site into its own environment, so the Environment pane's broom can't remove
# it. The reference bake (bake.R) sources the same file and calls describe(), so reference and
# learner fingerprints come from the same code:
#
#   lab <- new.env(); sys.source("/opt/lab/evidence.R", envir = lab); lab$describe(value)

evidence_dir <- "/home/rstudio/.lab"
max_calls <- 100L
size_cap <- 200e6 # bytes; bigger values are described by class and shape only

`%||%` <- function(a, b) if (is.null(a)) b else a

# ---------- Fingerprints ----------
# A value reduced to what a learner would call "the same result": data frames as their columns
# (tibble or data.frame, grouped or not, with or without readr's attributes), numbers to 10
# significant digits (so integer and double agree), and charts as the data their layers draw.
normalise <- function(x, depth = 0L) {
  if (depth > 30L) return("<deep>")
  if (inherits(x, "ggplot")) return(normalise_plot(x))
  if (is.data.frame(x)) {
    cols <- lapply(unclass(x), normalise, depth = depth + 1L)
    attributes(cols) <- NULL
    return(list("df", names(x), cols))
  }
  if (is.factor(x)) return(list("factor", levels(x), as.integer(x), is.ordered(x)))
  if (inherits(x, "POSIXt")) {
    x <- as.POSIXct(x)
    return(list("POSIXct", attr(x, "tzone") %||% "", round(as.numeric(x), 3)))
  }
  if (inherits(x, "Date")) return(list("Date", as.numeric(x)))
  if (inherits(x, "difftime")) return(list("difftime", units(x), signif(as.numeric(x), 10)))
  if (inherits(x, "lm")) return(list("lm", normalise(stats::coef(x), depth + 1L)))
  if (is.numeric(x) && !is.object(x)) return(list("num", names(x), signif(as.double(x), 10), dim(x)))
  if (is.atomic(x) && !is.object(x)) return(list(typeof(x), names(x), as.vector(x), dim(x)))
  if (is.function(x)) return(list("function", names(formals(x))))
  if (is.environment(x)) return("<environment>")
  if (is.list(x)) {
    items <- lapply(unclass(x), normalise, depth = depth + 1L)
    attributes(items) <- NULL
    return(list("list", class(x), names(x), items))
  }
  x # anything else (S4 objects such as lubridate periods) as it is
}

# The layers' built data, with columns in name order: ggplot2 orders them by where an aesthetic
# was mapped, which is a matter of style. Labels as ggplot2 resolves them.
normalise_plot <- function(p) {
  built <- suppressMessages(suppressWarnings(ggplot2::ggplot_build(p)))
  layers <- lapply(built$data, function(d) {
    d <- as.data.frame(d)
    normalise(d[, sort(names(d)), drop = FALSE])
  })
  labels <- ggplot2::get_labs(p)
  labels <- labels[sort(names(labels))]
  list("ggplot", layers, normalise(labels))
}

fingerprint <- function(x) rlang::hash(normalise(x))

# The same, ignoring row order, for steps where order is a matter of style: summarize(.by =) keeps
# groups in order of first appearance, group_by() |> summarize() sorts them. NULL when the rows
# can't be sorted (list-columns) or the value isn't a data frame.
fingerprint_any_order <- function(x) {
  if (!is.data.frame(x) || inherits(x, "sf")) return(NULL)
  cols <- unclass(x)
  if (!length(cols) || any(vapply(cols, is.list, logical(1)))) return(NULL)
  o <- do.call(order, c(unname(lapply(cols, function(v) if (is.factor(v)) as.character(v) else v)), list(method = "radix")))
  fingerprint(x[o, , drop = FALSE])
}

shape <- function(x) {
  list(class = class(x)[[1]], dim = if (!is.null(dim(x))) as.integer(dim(x)) else length(x))
}

# ---------- Recording ----------
session_id <- NULL
calls <- list()
pending <- list()
seq_no <- 0L
state <- NULL

# The package a top-level library() or require() call names, as the coach's "attached" check needs
# it: a package that was attached before the step began must be attached again to count.
library_call <- function(expr) {
  if (!is.call(expr) || !(identical(expr[[1]], as.name("library")) || identical(expr[[1]], as.name("require")))) return(NULL)
  call <- tryCatch(match.call(base::library, expr), error = function(e) NULL)
  pkg <- if (!is.null(call)) call$package
  if (is.name(pkg) || (is.character(pkg) && length(pkg) == 1L)) as.character(pkg) else NULL
}

assigned_name <- function(expr) {
  if (is.call(expr) && length(expr) == 3L && is.name(expr[[2]]) &&
      (identical(expr[[1]], as.name("<-")) || identical(expr[[1]], as.name("=")))) {
    as.character(expr[[2]])
  } else {
    NULL
  }
}

describe <- function(value) {
  size <- tryCatch(as.numeric(utils::object.size(value)), error = function(e) Inf)
  if (size > size_cap) return(c(shape(value), list(fp = NULL, fp_any = NULL)))
  c(shape(value), list(fp = tryCatch(fingerprint(value), error = function(e) NULL),
                       fp_any = tryCatch(fingerprint_any_order(value), error = function(e) NULL)))
}

# Runs after every successful top-level call (task callbacks don't run on errors). It only queues
# the value: fingerprinting a chart rebuilds it, which takes a few hundred milliseconds, so that
# happens in flush(), once R is idle and the learner already has the prompt back.
on_call <- function(expr, value, ok, visible) {
  seq_no <<- seq_no + 1L
  pending[[length(pending) + 1L]] <<- list(seq = seq_no, t = as.numeric(Sys.time()), visible = visible,
                                           assigned = assigned_name(expr), library = library_call(expr), value = value)
  if (length(pending) == 1L) later::later(flush, 0)
  TRUE # keep the callback registered
}

flush <- function() {
  queue <- pending
  pending <<- list()
  for (item in queue) {
    started <- proc.time()[["elapsed"]]
    # ggplot_build() can print messages (geom_smooth's formula) and warnings; the learner already
    # saw them when the plot printed, so none of this may reach the Console twice.
    out <- NULL
    utils::capture.output(type = "output",
      out <- tryCatch(suppressMessages(suppressWarnings(describe(item$value))), error = function(e) NULL))
    entry <- c(item[c("seq", "t", "visible", "assigned", "library")], out)
    entry$ms <- round((proc.time()[["elapsed"]] - started) * 1000)
    entry$queued_ms <- round((as.numeric(Sys.time()) - item$t) * 1000)
    calls[[length(calls) + 1L]] <<- entry
  }
  if (length(calls) > max_calls) calls <<- utils::tail(calls, max_calls)
  tryCatch(write_evidence(), error = function(e) NULL)
}

prefs_of_interest <- c("save_workspace", "load_workspace", "use_air_formatter", "insert_native_pipe_operator",
                       "code_formatter", "reformat_on_save")
# RStudio leaves a preference out of rstudio-prefs.json while it has its default value (ticking
# "Restore .RData" back on removes load_workspace), so report each one's effective value.
prefs_schema <- "/usr/lib/rstudio-server/resources/schema/user-prefs-schema.json"
pref_defaults <- function() {
  if (!file.exists(prefs_schema)) return(list())
  props <- jsonlite::read_json(prefs_schema)$properties
  lapply(props[intersect(prefs_of_interest, names(props))], function(p) p$default)
}
defaults <- NULL

read_state <- function() {
  wd <- getwd()
  files <- list.files(wd, recursive = TRUE, all.files = FALSE, no.. = TRUE)
  files <- utils::head(files[!startsWith(files, ".Rproj.user") & !startsWith(files, "data/")], 500L)
  info <- file.info(file.path(wd, files), extra_cols = FALSE)
  prefs_file <- path.expand("~/.config/rstudio/rstudio-prefs.json")
  prefs <- if (file.exists(prefs_file)) tryCatch(jsonlite::read_json(prefs_file), error = function(e) list()) else list()
  if (is.null(defaults)) defaults <<- tryCatch(pref_defaults(), error = function(e) list())
  prefs <- utils::modifyList(defaults, prefs[intersect(prefs_of_interest, names(prefs))])
  list(
    attached = sub("^package:", "", grep("^package:", search(), value = TRUE)),
    wd = wd,
    prefs = prefs,
    files = lapply(seq_along(files), function(i) list(path = files[[i]], mtime = as.numeric(info$mtime[[i]]), size = info$size[[i]]))
  )
}

write_evidence <- function() {
  doc <- list(session = session_id, seq = seq_no, written = as.numeric(Sys.time()), calls = calls, state = state)
  text <- jsonlite::toJSON(doc, auto_unbox = TRUE, null = "null", digits = NA)
  tmp <- file.path(evidence_dir, sprintf(".evidence-%s.json", Sys.getpid()))
  writeLines(text, tmp, useBytes = TRUE)
  file.rename(tmp, file.path(evidence_dir, "evidence.json"))
}

tick <- function() {
  new_state <- tryCatch(read_state(), error = function(e) state)
  if (!identical(new_state, state)) {
    state <<- new_state
    tryCatch(write_evidence(), error = function(e) NULL)
  }
  later::later(tick, 1)
}

install <- function() {
  if (!dir.exists(evidence_dir)) return(invisible(FALSE))
  session_id <<- sprintf("%s-%s", Sys.getpid(), format(Sys.time(), "%Y%m%dT%H%M%OS3"))
  addTaskCallback(on_call, name = "lab-evidence")
  # Start ticking once the session has finished starting up.
  later::later(tick, 1)
  invisible(TRUE)
}
