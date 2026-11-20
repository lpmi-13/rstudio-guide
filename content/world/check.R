# Checks that generate.R's output has every feature the lessons rely on. The runtime image runs it
# after generating the world, so a change that loses one fails the build.
#
#   Rscript check.R <dir>
dir <- commandArgs(trailingOnly = TRUE)[[1]]
suppressPackageStartupMessages({
  library(dplyr)
  library(readr)
})
failures <- character()
check <- function(ok, what) {
  ok <- isTRUE(ok)
  cat(if (ok) "ok  " else "FAIL", what, "\n")
  if (!ok) failures <<- c(failures, what)
}
path <- function(...) file.path(dir, ...)
quiet_csv <- function(file, ...) read_csv(file, show_col_types = FALSE, progress = FALSE, ...)

# Stations
stations <- quiet_csv(path("stations.csv"))
check(nrow(stations) >= 75 && nrow(stations) <= 90, "stations: about 80 rows")
check(sum(duplicated(stations$station_id)) == 1, "stations: exactly one duplicated station_id")
check(sum(!is.na(stations$former_name)) == 2, "stations: two renamed stations")
check(any(grepl("  ", stations$name, fixed = TRUE)), "stations: a name with a double space")
check(any(stations$name == toupper(stations$name)) && any(stations$name == tolower(stations$name)), "stations: a name in capitals and one in lower case")
check(any(grepl("’", stations$name)) && any(grepl("'", stations$name, fixed = TRUE)), "stations: curly and straight apostrophes")

# Trips
trips <- quiet_csv(path("trips.csv"))
check(nrow(trips) >= 130000 && nrow(trips) <= 170000, sprintf("trips: about 150,000 rows (%d)", nrow(trips)))
check(all(format(trips$started_at, "%Y") == "2025"), "trips: all start in 2025")
check(!any(duplicated(trips$trip_id)), "trips: trip_id is unique")
weekday <- trips |> filter(as.integer(format(started_at, "%u")) <= 5, member_type == "member")
by_hour <- table(as.integer(format(weekday$started_at, "%H")))
check(by_hour[["8"]] > 2 * by_hour[["12"]] && by_hour[["17"]] > 2 * by_hour[["12"]], "trips: members' weekday rush hours")
by_month <- table(as.integer(format(trips$started_at, "%m")))
check(by_month[["7"]] > 3 * by_month[["1"]], "trips: more trips in summer than winter")
speeds <- trips |>
  filter(duration_min > 0, duration_min < 240) |>
  summarize(speed = median(distance_km / duration_min * 60, na.rm = TRUE), .by = bike_type)
check(speeds$speed[speeds$bike_type == "electric"] > 1.2 * speeds$speed[speeds$bike_type == "classic"], "trips: e-bikes are faster")
check(sum(trips$duration_min == 0) >= 10, "trips: zero durations")
check(sum(trips$duration_min < 0) >= 5, "trips: negative durations")
check(sum(trips$duration_min > 1440) >= 10, "trips: multi-day trips")
check(sum(is.na(trips$end_station)) >= 100, "trips: missing end stations")
check(sum(is.na(trips$distance_km)) >= 10, "trips: missing distances")
check(all(grepl("^LB(-[CE]-)?[0-9]{5}$", trips$bike_id)), "trips: bike IDs follow one of the two formats")
spring <- trips |> filter(format(started_at, "%Y-%m-%d %H") == "2025-03-09 01", format(ended_at, "%Y-%m-%d %H") >= "2025-03-09 03")
check(nrow(spring) >= 1 && all(spring$duration_min < 60), "trips: one across the spring-forward change")
fall <- trips |> filter(as.Date(started_at) == as.Date("2025-11-02"), ended_at < started_at, duration_min > 0)
check(nrow(fall) >= 1, "trips: one across the fall-back change (clock end before start)")
check(setequal(setdiff(stations$station_id, trips$start_station), c(179, 180)), "trips: stations 179 and 180 have no trips")
check(all(stats::na.omit(c(trips$start_station, trips$end_station)) %in% stations$station_id), "trips: every station is in stations.csv")

# Archive
con <- DBI::dbConnect(duckdb::duckdb(shared_home = FALSE))
glob <- path("archive", "**", "*.parquet")
years <- DBI::dbGetQuery(con, sprintf("SELECT year, count(*) AS n FROM read_parquet('%s', hive_partitioning = true) GROUP BY year ORDER BY year", glob))
check(identical(as.integer(years$year), 2021:2025), "archive: 2021 to 2025")
check(years$n[years$year == 2025] == nrow(trips), "archive: 2025 equals trips.csv")
same <- DBI::dbGetQuery(con, sprintf("SELECT sum(duration_min) AS d, count(DISTINCT bike_id) AS b FROM read_parquet('%s', hive_partitioning = true) WHERE year = 2025", glob))
check(isTRUE(all.equal(same$d, sum(trips$duration_min))) && same$b == n_distinct(trips$bike_id), "archive: 2025's values match trips.csv")
DBI::dbDisconnect(con)

# Weather
weather <- quiet_csv(path("weather.csv"))
check(nrow(weather) < 8760 - 40, "weather: sensor gaps (missing hours)")
check(sum(weather$temp_c == -99) >= 5 && sum(weather$wind_kmh == -99) >= 3, "weather: -99 sentinels")
times <- read_lines(path("weather.csv"))[-1]
check(!any(startsWith(times, "2025-03-09 02:")), "weather: no 2 am on 9 March (spring forward)")
check(sum(startsWith(times, "2025-11-02 01:00")) == 2, "weather: 1 am twice on 2 November (fall back)")

# Bikes and fares
bikes <- quiet_csv(path("bikes.csv"))
check(!any(duplicated(bikes$bike_id)) && sum(grepl("^LB[0-9]{5}$", bikes$bike_id)) >= 5, "bikes: unique IDs, a few in the old format")
check(all(trips$bike_id %in% bikes$bike_id), "bikes: every trip's bike is listed")
fares <- quiet_csv(path("fares.csv"))
check(sum(is.na(fares$valid_to)) == 4, "fares: the current period is open-ended")

# Survey
survey <- quiet_csv(path("survey.csv"))
check(nrow(survey) == 1500 && sum(startsWith(names(survey), "use_")) == 5, "survey: 1,500 responses, five use_ columns")
check(any(grepl("[^\\x01-\\x7F]", survey$comment, perl = TRUE)) && any(grepl("\U0001F6B2", survey$comment)), "survey: comments with accents and emoji")
check(sum(grepl("\\b(LARK-[A-Z0-9-]+|STUDENT25|WELCOME10)\\b", survey$comment)) >= 30, "survey: promo codes in comments")
scale <- c("Very dissatisfied", "Dissatisfied", "Neutral", "Satisfied", "Very satisfied")
check(setequal(survey$satisfaction, scale) && !identical(sort(scale), scale), "survey: satisfaction as text, not in order when sorted")

# Monthly exports
exports <- list.files(path("exports"), full.names = TRUE)
check(length(exports) == 12, "exports: 12 monthly files")
problems_each <- vapply(exports, function(f) {
  x <- suppressWarnings(quiet_csv(f, skip = 1, na = c("n/a", "-", ""), col_types = cols(`Dock Faults` = col_integer(), .default = col_guess())))
  nrow(problems(x))
}, integer(1))
check(all(problems_each == 1), "exports: one dock-fault value that isn't a number in each")
codes_each <- vapply(exports, function(f) {
  text <- read_lines(f)
  all(grepl(",n/a(,|$)", text) |> any(), grepl(",-(,|$)", text) |> any(), grepl(",,|,$", text) |> any())
}, logical(1))
check(all(codes_each), "exports: n/a, - and blank in each")
first <- read_lines(exports[[1]], n_max = 2)
check(startsWith(first[[1]], "Larkhaven Bikes") && startsWith(first[[2]], "Station ID,"), "exports: a title line above the header")
check(any(grepl("[0-9] km", read_lines(exports[[1]]))), "exports: units inside values")
jan <- quiet_csv(exports[[1]], skip = 1)
check("Gasworks Lane" %in% jan$`Station Name` && !("Gasworks Lane" %in% quiet_csv(exports[[12]], skip = 1)$`Station Name`), "exports: renamed stations use their old names before the change")

# Wide tables
months <- quiet_csv(path("station-months.csv"))
check(all(tolower(month.abb) %in% names(months)) && anyNA(months$jan), "station-months: one column per month, with gaps")
periods <- quiet_csv(path("station-periods.csv"))
check(identical(names(periods), c("station_id", "weekday_am", "weekday_pm", "weekend_am", "weekend_pm")), "station-periods: two variables in each column name")
riders <- quiet_csv(path("station-riders.csv"))
check(identical(names(riders), c("station_id", "trips_member", "trips_casual", "minutes_member", "minutes_casual")), "station-riders: a .value layout")

# Maintenance workbook
sheets <- readxl::excel_sheets(path("maintenance.xlsx"))
check(identical(sheets, c("Summary", "Northgate", "Harbour", "Eastfield")), "maintenance: a summary and three depot sheets")
summary_sheet <- readxl::read_excel(path("maintenance.xlsx"), sheet = "Summary")
check(sum(!is.na(summary_sheet$Depot)) == 3 && nrow(summary_sheet) == 36, "maintenance: Depot filled in once per block")
depot <- suppressWarnings(readxl::read_excel(path("maintenance.xlsx"), sheet = "Northgate", skip = 3))
check(identical(names(depot)[1:3], c("Date", "Bike", "Fault")), "maintenance: header below two title rows and a blank row")
check(is.character(depot$Date) && any(grepl("^4[56][0-9]{3}$", depot$Date)) && "Total" %in% depot$Date, "maintenance: dates as serial numbers, and a total row")
check(is.character(depot$Minutes) && any(grepl("approx", depot$Minutes)), "maintenance: notes typed into Minutes")

# Feed
info <- jsonlite::read_json(path("feed", "station_information.json"))
status <- jsonlite::read_json(path("feed", "station_status.json"))
st <- status$data$stations
check(length(st) >= 75, "feed: a status for each station")
check(any(vapply(st, function(s) is.null(s$num_docks_disabled), logical(1))) && any(vapply(st, function(s) !is.null(s$num_docks_disabled), logical(1))), "feed: an optional field some stations have")
check(any(lengths(lapply(st, `[[`, "vehicle_types_available")) == 1) && any(lengths(lapply(st, `[[`, "vehicle_types_available")) == 2), "feed: vehicle counts as lists of different lengths")
check(is.list(info$data$stations[[1]]$name), "feed: names as lists of translations")

# Website
page <- xml2::read_html(path("site", "stations.html"))
cards <- xml2::xml_find_all(page, "//article[@class='station']")
notes <- xml2::xml_find_all(page, "//article[@class='station']/p[@class='note']")
check(length(cards) >= 75 && length(notes) >= 1 && length(notes) < length(cards), "site: station cards, some with a note")
check(length(xml2::xml_find_all(xml2::read_html(path("site", "fares.html")), "//table")) == 1, "site: a fares table")

if (length(failures)) {
  cat(sprintf("\n%d check(s) failed\n", length(failures)))
  quit(status = 1)
}
cat("\nall checks passed\n")
