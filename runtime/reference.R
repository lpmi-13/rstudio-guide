# Reference run for a demonstration scenario. Runs each run-NNN.R file in order
# in one environment, as the RStudio Console would, and records what R prints
# (run-NNN.out) and whether a plot was drawn (run-NNN.plot). On an error it
# writes run-NNN.err and exits with status 1.
#
#   Rscript reference.R <dir>
dir <- commandArgs(trailingOnly = TRUE)[[1]]
setwd(tempdir())
options(width = 200)
env <- new.env(parent = globalenv())
files <- sort(list.files(dir, pattern = "^run-[0-9]+\\.R$", full.names = TRUE))
for (f in files) {
  while (!is.null(dev.list())) dev.off()
  out <- tryCatch(
    capture.output(source(f, local = env, echo = FALSE, print.eval = TRUE)),
    error = function(e) {
      writeLines(conditionMessage(e), sub("\\.R$", ".err", f))
      quit(status = 1)
    }
  )
  writeLines(out, sub("\\.R$", ".out", f))
  writeLines(if (is.null(dev.list())) "0" else "1", sub("\\.R$", ".plot", f))
}
