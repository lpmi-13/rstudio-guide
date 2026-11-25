# The reference bake: runs one lesson's statements in a fresh R process, as RStudio's Console would,
# and records what each one did. tools/bake.py runs it twice per lesson, each time in a throwaway,
# network-less container from the runtime image, and compares the two runs.
#
#   Rscript /opt/lab/bake.R <plan.json> <out.json>
#
# The working directory is a copy of the lesson's project, data/ included. The plan lists the
# lesson's statements in order: each one's code (or an IDE action) and what its evidence needs.
# For each statement this records what the Console would print (at width 200, as the reference
# runs always have), whether the value was visible, its fingerprint and the name it assigned (from
# evidence.R, the same code the live session uses), the package a library() call names, whether it
# drew a chart, the warnings and messages it raised, the files it wrote, and the values its
# explanation quotes. It stops at the first failure:
#
#   - an error, unless the statement expects one ("error": a regular expression for the message);
#   - a warning the statement doesn't declare ("warning": a regular expression), deprecations
#     included, or a declared warning that never came;
#   - a chart where the evidence expects none, or none where it expects one;
#   - evidence the statement can't give: an assignment that assigns nothing, a "file" it didn't
#     write, a "pattern" its output doesn't match;
#   - an alternative whose value differs from the statement's;
#   - in a strict lesson, code that Air would format differently;
#   - in a strict lesson, a ggplot with an axis that has no title or fewer than two tick labels, or
#     a theme that hides them, unless the statement says why with "axes" (axis_problems).
# The lesson's code runs in the global environment, as in the Console; everything here lives in
# its own environment so that code (or a simulated Restart R) can't touch it.
local({
  args <- commandArgs(trailingOnly = TRUE)
  plan <- jsonlite::read_json(args[[1]], simplifyVector = FALSE)
  out_file <- args[[2]]
  options(width = 200, lifecycle_verbosity = "warning", warn = 1, useFancyQuotes = TRUE, cli.dynamic = FALSE)
  lab <- new.env()
  sys.source("/opt/lab/evidence.R", envir = lab)
  # As in the lab's RStudio, where ~/.duckdb exists so duckdb asks nothing.
  dir.create(file.path(Sys.getenv("HOME"), ".duckdb"), showWarnings = FALSE)

  # Functions that only show something in RStudio's panes do nothing here.
  local({
    stubs <- new.env()
    stubs$View <- function(x, title) invisible(NULL)
    stubs$browseURL <- function(url, ...) invisible(NULL)
    attach(stubs, name = "tools:bake", warn.conflicts = FALSE)
  })

  # Charts go to a device that writes nothing (a chart drawn with no device open would otherwise
  # create Rplots.pdf in the project).
  options(device = function(...) grDevices::pdf(NULL, width = 7, height = 5))
  grDevices::dev.new()
  grDevices::dev.control("enable")
  plots_device <- grDevices::dev.cur() # RStudio's Plots pane; ggsave() and png() draw elsewhere
  pages <- 0L
  count_page <- function() if (grDevices::dev.cur() == plots_device) pages <<- pages + 1L
  setHook("plot.new", count_page)
  setHook("grid.newpage", count_page)
  drawing <- function() {
    if (grDevices::dev.cur() != plots_device) return(c(pages, -1L))
    shown <- tryCatch(length(grDevices::recordPlot()[[1]]), error = function(e) 0L)
    c(pages, shown)
  }

  # The project's files and when each changed, leaving out the data and RStudio's and Quarto's own
  # folders (Quarto names some of its cache files at random).
  project_files <- function() {
    files <- list.files(".", recursive = TRUE, all.files = TRUE, no.. = TRUE)
    files <- files[!startsWith(files, "data/") & !startsWith(files, ".Rproj.user") & !grepl("(^|/)\\.quarto/", files)]
    stats::setNames(as.numeric(file.mtime(files)), files)
  }

  failures <- character()
  fail <- function(run, text) failures <<- c(failures, sprintf("step %s, `%s`: %s", run$step, label(run), text))
  label <- function(run) {
    text <- if (!is.null(run$code)) run$code else paste("action", run$action)
    text <- strsplit(text, "\n", fixed = TRUE)[[1]][[1]]
    if (nchar(text) > 60) paste0(substr(text, 1, 57), "...") else text
  }
  `%||%` <- function(a, b) if (is.null(a)) b else a

  # Evaluate `code` at top level, as the Console does: each top-level expression on its own, its value
  # printed if visible. Returns what happened; the last expression's value is the statement's value.
  console <- function(code, env = globalenv(), print = TRUE) {
    warnings <- character()
    messages <- character()
    result <- list(ok = TRUE, error = NULL, visible = FALSE, value = NULL, expr = NULL)
    output <- utils::capture.output(type = "output", {
      exprs <- tryCatch(parse(text = code, keep.source = FALSE), error = function(e) e)
      if (inherits(exprs, "error")) {
        result$ok <- FALSE
        result$error <- conditionMessage(exprs)
      } else {
        for (expr in exprs) {
          step <- withCallingHandlers(
            tryCatch(withVisible(eval(expr, env)), error = function(e) e),
            warning = function(w) {
              warnings <<- c(warnings, conditionMessage(w))
              invokeRestart("muffleWarning")
            },
            message = function(m) {
              messages <<- c(messages, sub("\n$", "", conditionMessage(m)))
              invokeRestart("muffleMessage")
            }
          )
          if (inherits(step, "error")) {
            result$ok <- FALSE
            result$error <- conditionMessage(step)
            break
          }
          result$visible <- step$visible
          result$value <- step$value
          result$expr <- expr
          if (step$visible && print) {
            printed <- withCallingHandlers(
              tryCatch({
                if (isS4(step$value)) methods::show(step$value) else print(step$value)
                NULL
              }, error = function(e) e),
              warning = function(w) {
                warnings <<- c(warnings, conditionMessage(w))
                invokeRestart("muffleWarning")
              },
              message = function(m) {
                messages <<- c(messages, sub("\n$", "", conditionMessage(m)))
                invokeRestart("muffleMessage")
              }
            )
            if (inherits(printed, "error")) {
              result$ok <- FALSE
              result$error <- conditionMessage(printed)
              break
            }
          }
        }
      }
    })
    c(result, list(output = paste(output, collapse = "\n"), warnings = warnings, messages = messages))
  }

  describe <- function(value) {
    d <- lab$describe(value)
    list(class = d$class, dim = d$dim, fp = d$fp, fp_any = d$fp_any)
  }

  # Restart R, as far as one process can: forget every object and detach the packages attached since.
  initial_search <- search()
  restart <- function() {
    rm(list = ls(globalenv(), all.names = TRUE), envir = globalenv())
    for (name in setdiff(search(), initial_search)) {
      if (startsWith(name, "package:")) try(detach(name, character.only = TRUE, unload = FALSE, force = TRUE), silent = TRUE)
    }
  }

  # Air, as RStudio runs it when "Use Air" is on: is each statement already formatted that way?
  air_check <- function(runs) {
    codes <- vapply(runs, function(r) r$code %||% "", character(1))
    keep <- nzchar(codes)
    if (!any(keep)) return(invisible())
    dir <- tempfile("air")
    dir.create(dir)
    files <- file.path(dir, sprintf("s%03d.R", seq_along(codes)))
    for (i in which(keep)) writeLines(codes[[i]], files[[i]])
    status <- system2("air", c("format", files[keep]), stdout = TRUE, stderr = TRUE)
    for (i in which(keep)) {
      formatted <- paste(readLines(files[[i]], warn = FALSE), collapse = "\n")
      if (!identical(formatted, codes[[i]])) {
        fail(runs[[i]], sprintf("Air formats it as\n%s", formatted))
      }
    }
  }

  if (isTRUE(plan$strict)) air_check(plan$runs)

  # A chart a reader can read has both axes titled and labelled (the user's call, 25 November 2026:
  # no chart may be missing its axis labels). Checked on the chart as drawn: its resolved axis titles,
  # the tick labels ggplot2 placed, and the theme. A patchwork is checked plot by plot. Returns what is
  # missing, as text for the bake's failure.
  axis_problems <- function(p) {
    if (inherits(p, "patchwork")) return(unique(c(unlist(lapply(p$patches$plots, axis_problems)), one_plot_axes(p))))
    one_plot_axes(p)
  }
  # A patchwork's own plot is its last one: ggplot_build() on the patchwork builds only that.
  one_plot_axes <- function(p) {
    built <- suppressMessages(suppressWarnings(ggplot2::ggplot_build(p)))
    labels <- ggplot2::get_labs(p)
    theme <- ggplot2::complete_theme(p@theme)
    params <- built$layout$panel_params[[1]]
    problems <- character()
    for (axis in c("x", "y")) {
      title <- paste(as.character(labels[[axis]] %||% ""), collapse = "")
      if (!nzchar(trimws(title))) problems <- c(problems, sprintf("its %s axis has no title", axis))
      ticks <- tryCatch(as.character(unlist(params[[axis]]$get_labels())), error = function(e) character())
      ticks <- ticks[!is.na(ticks) & nzchar(trimws(ticks))]
      if (length(ticks) < 2L) problems <- c(problems, sprintf("its %s axis has %d tick label%s", axis, length(ticks), if (length(ticks) == 1L) "" else "s"))
      side <- if (axis == "x") "bottom" else "left"
      for (element in sprintf(c("axis.title.%s.%s", "axis.text.%s.%s"), axis, side)) {
        if (inherits(ggplot2::calc_element(element, theme), "element_blank")) problems <- c(problems, sprintf("its theme hides %s", element))
      }
    }
    problems
  }

  records <- list()
  sourced <- character() # the script's statements so far, for a "source" action
  for (run in plan$runs) {
    if (length(failures)) break
    record <- list(index = run$index, step = run$step)
    before_files <- project_files()
    before_drawing <- drawing()
    before_search <- search()

    if (!is.null(run$action)) {
      # IDE actions change RStudio, not R, except these.
      if (identical(run$action, "menu") && identical(unlist(run$menu), c("Session", "Restart R"))) restart()
      # Source runs the script from the top: every statement so far, as the coach typed them below
      # their headings. A statement meant to fail would stop it there, so none may come before.
      if (identical(run$action, "source")) {
        for (code in sourced) {
          res <- suppressWarnings(suppressMessages(console(code, print = FALSE)))
          if (!res$ok) {
            fail(run, sprintf("sourcing the script would stop at `%s`: %s", strsplit(code, "\n", fixed = TRUE)[[1]][[1]], res$error))
            break
          }
        }
      }
      if (identical(run$action, "type")) {
        lines <- readLines(plan$script, warn = FALSE)
        at <- if (is.null(run$after)) max(c(0L, which(nzchar(trimws(lines))))) else which(grepl(run$after, lines, perl = TRUE))[1]
        if (is.na(at)) fail(run, sprintf("no line of %s matches %s", plan$script, run$after))
        else writeLines(append(lines, strsplit(run$text, "\n", fixed = TRUE)[[1]], after = at), plan$script)
      }
      if (identical(run$action, "render")) {
        rendered <- console(sprintf("quarto::quarto_render(%s, quiet = TRUE)", deparse(run$file)), print = FALSE)
        if (!rendered$ok) fail(run, sprintf("rendering %s failed: %s", run$file, rendered$error))
      }
      after <- project_files()
      record$files <- I(sort(names(after)[is.na(before_files[names(after)]) | after != before_files[names(after)]]))
      if (!is.null(run$path) && !(run$path %in% record$files)) fail(run, sprintf("it should write %s, but didn't", run$path))
      records[[length(records) + 1]] <- record
      next
    }

    # Alternatives first, each in its own environment on top of the global one, so they see the
    # state just before the statement and leave it as it was.
    alternatives <- list()
    for (alt in run$alternatives %||% list()) {
      env <- new.env(parent = globalenv())
      res <- suppressWarnings(suppressMessages(console(alt, env = env, print = FALSE)))
      if (!res$ok) {
        fail(run, sprintf("the alternative `%s` failed: %s", alt, res$error))
        next
      }
      name <- lab$assigned_name(res$expr)
      value <- if (!is.null(name) && exists(name, envir = env, inherits = FALSE)) get(name, envir = env) else res$value
      alternatives[[length(alternatives) + 1]] <- c(list(code = alt, assigned = name), describe(value))
    }
    # A chart an alternative drew isn't the statement's.
    before_drawing <- drawing()

    # In a lesson whose script is a Quarto document, the statement also goes into the document,
    # below its step's heading in a chunk, as the coach types it, so that rendering runs it too.
    if (isTRUE(grepl("\\.qmd$", plan$script))) {
      lines <- readLines(plan$script, warn = FALSE)
      at <- match(run$heading, trimws(lines, "right"))
      if (is.na(at)) {
        fail(run, sprintf("%s has no line %s", plan$script, run$heading))
      } else {
        end <- which(seq_along(lines) > at & grepl("^(# Step \\d+\\. |```)", lines))[1]
        if (is.na(end)) end <- length(lines) + 1L
        block <- seq.int(at, end - 1L)
        last <- max(block[nzchar(trimws(lines[block]))])
        writeLines(append(lines, strsplit(run$code, "\n", fixed = TRUE)[[1]], after = last), plan$script)
      }
    }

    res <- console(run$code)
    sourced <- c(sourced, run$code)
    record$output <- res$output
    record$warnings <- I(res$warnings)
    record$messages <- I(res$messages)
    record$visible <- res$visible
    if (!res$ok) {
      record$error <- res$error
      if (is.null(run$error) || !grepl(run$error, res$error, perl = TRUE)) {
        fail(run, sprintf("R reported an error: %s", res$error))
      }
    } else if (!is.null(run$error)) {
      fail(run, "it should end in an error, but didn't")
    }
    if (length(res$warnings)) {
      undeclared <- if (is.null(run$warning)) res$warnings else res$warnings[!grepl(run$warning, res$warnings, perl = TRUE)]
      if (length(undeclared)) fail(run, sprintf("an undeclared warning: %s", undeclared[[1]]))
    } else if (!is.null(run$warning)) {
      fail(run, "it declares a warning, but none came")
    }

    if (res$ok) {
      record$assigned <- lab$assigned_name(res$expr)
      record$library <- lab$library_call(res$expr)
      record <- c(record, describe(res$value))
      record$attached <- I(sub("^package:", "", setdiff(search(), before_search)))
    }
    record$plot <- !identical(drawing(), before_drawing)
    after <- project_files()
    record$files <- I(sort(names(after)[is.na(before_files[names(after)]) | after != before_files[names(after)]]))

    evidence <- run$evidence
    draws <- evidence %in% c("plot", "ggplot")
    if (res$ok && record$plot != draws) {
      fail(run, if (draws) "it should draw a chart, but didn't" else sprintf("it drew a chart, but its evidence is %s", evidence))
    }
    if (res$ok) {
      if (identical(evidence, "assign") && is.null(record$assigned)) fail(run, "its evidence is assign, but it assigns no name")
      if (identical(evidence, "attached") && is.null(record$library)) fail(run, "its evidence is attached, but it isn't a library() call")
      if (identical(evidence, "ggplot") && !(inherits(res$value, "ggplot") && res$visible)) fail(run, "its evidence is ggplot, but it doesn't print a ggplot")
      if (identical(evidence, "ggplot") && isTRUE(plan$strict) && is.null(run$axes) && inherits(res$value, "ggplot")) {
        for (problem in tryCatch(axis_problems(res$value), error = function(e) sprintf("its axes couldn't be checked: %s", conditionMessage(e)))) {
          fail(run, sprintf("%s (every chart needs both axes titled and labelled; \"axes\" says why one can't)", problem))
        }
      }
      if (identical(evidence, "value") && is.null(record$fp)) fail(run, "its value is too big to fingerprint")
      if (identical(evidence, "file") && !(isTRUE(run$path %in% record$files))) fail(run, sprintf("it should write %s, but didn't", run$path))
      if (identical(evidence, "pattern") && !grepl(run$pattern, res$output, perl = TRUE)) {
        fail(run, sprintf("its output doesn't match %s: %s", run$pattern, substr(res$output, 1, 200)))
      }
    }

    for (alt in alternatives) {
      same <- if (identical(run$order, "any")) identical(alt$fp_any, record$fp_any) else identical(alt$fp, record$fp)
      if (identical(evidence, "assign")) same <- same && identical(alt$assigned, record$assigned)
      if (!same) fail(run, sprintf("the alternative `%s` gives a different value", alt$code))
    }
    record$alternatives <- alternatives

    # Values the explanation quotes: R expressions evaluated now, or (older lessons) patterns read
    # from what the Console printed.
    values <- structure(list(), names = character()) # {} in JSON, not []
    for (name in names(run$values)) {
      v <- tryCatch(eval(parse(text = run$values[[name]]), globalenv()), error = function(e) e)
      if (inherits(v, "error") || length(v) != 1L) {
        fail(run, sprintf("value %s: %s", name, if (inherits(v, "error")) conditionMessage(v) else "not a single value"))
      } else {
        values[[name]] <- as.character(v)
      }
    }
    flat <- gsub("\\s+", " ", trimws(res$output))
    for (name in names(run$capture)) {
      m <- regmatches(flat, regexec(run$capture[[name]], flat, perl = TRUE))[[1]]
      if (length(m) < 2) fail(run, sprintf("capture %s doesn't match the output: %s", name, substr(flat, 1, 200))) else values[[name]] <- m[[2]]
    }
    record$values <- values
    records[[length(records) + 1]] <- record
  }

  jsonlite::write_json(
    list(r = R.version.string, runs = records, failures = I(failures)),
    out_file, auto_unbox = TRUE, null = "null", digits = NA, pretty = TRUE
  )
  if (length(failures)) quit(status = 1)
})
