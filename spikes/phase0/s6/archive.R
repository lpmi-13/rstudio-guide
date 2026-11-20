# S6: how big is the trip archive, and how long does generating it take? A rough stand-in for the
# Phase 1 generator: about 2 million trips over five years, with the columns lesson 22 needs,
# written as Parquet partitioned by year and month (DuckDB's COPY), plus one year as CSV.
#
#   Rscript archive.R <out-dir> [rows]
args <- commandArgs(trailingOnly = TRUE)
out <- args[[1]]
n <- if (length(args) > 1) as.integer(args[[2]]) else 2000000L
suppressPackageStartupMessages({ library(dplyr); library(DBI) })
set.seed(20261120)

t0 <- proc.time()[["elapsed"]]
tz <- "America/Chicago"
start <- as.POSIXct("2021-01-01", tz = tz)
span <- as.numeric(difftime(as.POSIXct("2026-01-01", tz = tz), start, units = "secs"))
# More trips in summer and at rush hour: draw times, then keep them with those probabilities.
draw <- function(k) {
  s <- start + runif(k * 6, 0, span) # about 27% are kept
  lt <- as.POSIXlt(s)
  season <- 0.55 + 0.45 * sin((lt$yday - 100) / 365 * 2 * pi)
  rush <- ifelse(lt$hour %in% c(7, 8, 16, 17, 18), 1, ifelse(lt$hour %in% 0:5, 0.08, 0.45))
  s[runif(length(s)) < season * rush][seq_len(k)]
}
started <- sort(draw(n))
bike_type <- sample(c("classic", "electric"), n, replace = TRUE, prob = c(0.62, 0.38))
distance <- round(rgamma(n, shape = 2.2, rate = 1.1), 2)
speed <- ifelse(bike_type == "electric", rnorm(n, 17, 3), rnorm(n, 12, 2.5))
duration <- round(pmax(1, distance / pmax(speed, 4) * 60 + rexp(n, 1 / 3)), 1)
trips <- tibble(
  trip_id = seq_len(n),
  bike_id = sprintf("LB-%s-%05d", ifelse(bike_type == "electric", "E", "C"), sample.int(1400, n, replace = TRUE)),
  started_at = started,
  ended_at = started + duration * 60,
  start_station = sample.int(80, n, replace = TRUE),
  end_station = sample.int(80, n, replace = TRUE),
  member_type = sample(c("member", "casual"), n, replace = TRUE, prob = c(0.7, 0.3)),
  bike_type = bike_type,
  distance_km = distance,
  duration_min = duration
)
trips$end_station[sample.int(n, n %/% 2000)] <- NA # lost bikes
gen_s <- proc.time()[["elapsed"]] - t0

con <- dbConnect(duckdb::duckdb())
duckdb::duckdb_register(con, "trips", trips |> mutate(year = as.integer(format(started_at, "%Y")), month = as.integer(format(started_at, "%m"))))
t1 <- proc.time()[["elapsed"]]
dbExecute(con, sprintf("COPY trips TO '%s/archive' (FORMAT parquet, PARTITION_BY (year, month), COMPRESSION zstd)", out))
parquet_s <- proc.time()[["elapsed"]] - t1
t2 <- proc.time()[["elapsed"]]
readr::write_csv(trips |> filter(format(started_at, "%Y") == "2025"), file.path(out, "trips-2025.csv"))
csv_s <- proc.time()[["elapsed"]] - t2
# A query that only needs one year's partitions, the way lesson 22 would ask it.
t3 <- proc.time()[["elapsed"]]
q <- dbGetQuery(con, sprintf("SELECT bike_type, count(*) AS trips, median(duration_min) AS median_min FROM read_parquet('%s/archive/**/*.parquet', hive_partitioning = true) WHERE year = 2024 GROUP BY bike_type ORDER BY bike_type", out))
query_s <- proc.time()[["elapsed"]] - t3
dbDisconnect(con)

size <- function(path) sum(file.info(list.files(path, recursive = TRUE, full.names = TRUE))$size)
cat(sprintf("rows %d | generate %.1fs | parquet %.1fs (%d files, %.1f MB) | 2025 CSV %.1fs (%d rows, %.1f MB) | one-year query %.2fs | peak R memory %.0f MB\n",
  n, gen_s, parquet_s, length(list.files(file.path(out, "archive"), recursive = TRUE)), size(file.path(out, "archive")) / 1e6,
  csv_s, sum(format(trips$started_at, "%Y") == "2025"), file.size(file.path(out, "trips-2025.csv")) / 1e6, query_s,
  sum(gc()[, 6])))
print(q)
