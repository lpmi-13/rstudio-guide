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
routes <- trips |> summarize(trips = n(), mean_minutes = mean(duration_min), .by = c(start_station, end_station))
check(max(slice_max(filter(routes, !is.na(end_station)), mean_minutes, n = 5)$trips) <= 3, "trips: the routes with the longest mean trip, ending at a station, are tiny groups (lesson 3)")
check(all(stats::na.omit(c(trips$start_station, trips$end_station)) %in% stations$station_id), "trips: every station is in stations.csv")

# One week of complete trips (lesson 1)
week <- quiet_csv(path("trips-week.csv"))
in_week <- trips |> filter(started_at >= as.POSIXct("2025-06-02", tz = "UTC"), started_at < as.POSIXct("2025-06-09", tz = "UTC"))
check(identical(week$trip_id, in_week$trip_id[!is.na(in_week$end_station) & in_week$duration_min > 0]), "trips-week: 2-8 June's trips, less the faulty ones")
check(nrow(week) >= 3000 && nrow(week) <= 6000, sprintf("trips-week: a few thousand trips (%d)", nrow(week)))
check(!anyNA(week) && all(week$duration_min > 0) && max(week$duration_min) < 240, "trips-week: no missing values, no zero, negative or multi-day durations")
check(setequal(unique(weekdays(week$started_at)), weekdays(as.Date("2025-06-02") + 0:6)), "trips-week: all seven days")

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

# Lesson 1's hourly chart of the week: rain empties two weekday hours, and each weekend day has one broad hump
hourly <- week |> count(day = as.Date(started_at), hour = as.integer(format(started_at, "%H")))
trips_at <- function(day, h) sum(hourly$n[hourly$day == as.Date(day) & hourly$hour == h])
rain_at <- function(time) weather$rain_mm[format(weather$time, "%Y-%m-%d %H:%M") == time]
check(isTRUE(rain_at("2025-06-02 17:00") >= 1) && trips_at("2025-06-02", 17) < trips_at("2025-06-02", 18) / 3, "trips-week: rain empties Monday at 5 pm")
check(isTRUE(rain_at("2025-06-05 13:00") >= 1) && trips_at("2025-06-05", 13) < trips_at("2025-06-05", 16) / 3, "trips-week: rain empties Thursday around midday")
weekend <- hourly |> filter(day %in% as.Date(c("2025-06-07", "2025-06-08")))
hump <- weekend |> summarize(ok = hour[which.max(n)] %in% 11:16 && all(n[hour %in% 11:16] >= 0.75 * max(n)), .by = day)
check(nrow(hump) == 2 && all(hump$ok), "trips-week: one broad hump from 11:00 to 16:00 on Saturday and Sunday")

# Lesson 6's line of trips per day: each sharp dip (under 70% of the same weekday's trips one and two
# weeks either side) is a day of daytime rain or of cold
daily <- trips |> count(date = as.Date(started_at), name = "trips") |> arrange(date)
daily$usual <- (dplyr::lag(daily$trips, 7) + dplyr::lead(daily$trips, 7) + dplyr::lag(daily$trips, 14) + dplyr::lead(daily$trips, 14)) / 4
days <- weather |>
  mutate(date = as.Date(time), hour = as.integer(format(time, "%H")), temp_c = if_else(temp_c == -99, NA, temp_c)) |>
  summarize(day_rain = sum(rain_mm[hour %in% 7:20], na.rm = TRUE), top_c = max(temp_c, na.rm = TRUE), .by = date)
dips <- daily |> filter(trips < 0.7 * usual) |> left_join(days, by = "date")
check(nrow(dips) >= 10 && all(dips$day_rain >= 1 | dips$top_c < -5), sprintf("trips: each of the %d sharp dips in trips per day is a day of rain or below -5 °C (lesson 6)", nrow(dips)))
rises <- daily |> mutate(change = trips - dplyr::lag(trips)) |> slice_max(change, n = 1)
check(isTRUE((rises$date - 1) %in% dips$date), "trips: the day before the biggest rise from one day to the next is a sharp dip (lesson 13)")
slots <- trips |> count(slot = (as.integer(format(started_at, "%H")) * 60 + as.integer(format(started_at, "%M"))) %/% 15 * 15, sort = TRUE)
check(slots$slot[1] == 17 * 60, "trips: the busiest 15-minute slot starts at 17:00 (lesson 13)")

# Lessons 9 and 10: each weekday of the June week, and the year's weekdays overall, peak at both rush hours
peaks <- function(d) {
  by <- table(factor(as.integer(format(d$started_at, "%H")), levels = 0:23))
  max(by[as.character(7:9)]) > max(by[as.character(11:13)]) && max(by[as.character(16:18)]) > max(by[as.character(11:13)])
}
week_days <- split(week, as.Date(week$started_at))
weekdays_week <- week_days[as.integer(format(as.Date(names(week_days)), "%u")) <= 5]
check(length(weekdays_week) == 5 && all(vapply(weekdays_week, peaks, logical(1))), "trips-week: every weekday has a morning and an evening peak above midday (lesson 9)")
check(peaks(trips[as.integer(format(trips$started_at, "%u")) <= 5, ]), "trips: weekdays peak at both rush hours (lesson 10)")

# Lesson 10: a trip with no distance, or a distance of 0, also has an impossible length, so the
# log-log model never meets log(0) and leaving out the 135 implausible lengths leaves out these too
bad_length <- trips$duration_min <= 0 | trips$duration_min > 24 * 60
check(all(bad_length[is.na(trips$distance_km) | trips$distance_km %in% 0]), "trips: every trip with no or zero distance has an implausible length (lesson 10)")

# Lesson 18: June's sensor gap covers all of 24 June
june_hours <- weather$time[format(weather$time, "%Y-%m") == "2025-06"]
check(!any(format(june_hours, "%Y-%m-%d") == "2025-06-24") && length(june_hours) < 30 * 24 - 24, "weather: no reading at all on 24 June (lesson 18)")

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

# The database (lesson 21): the same four tables as the CSV files
con <- DBI::dbConnect(duckdb::duckdb(shared_home = FALSE), dbdir = path("larkhaven.duckdb"), read_only = TRUE)
check(setequal(DBI::dbListTables(con), c("bikes", "fares", "stations", "trips")), "database: four tables")
check(DBI::dbGetQuery(con, "SELECT COUNT(*) AS n FROM trips")$n == nrow(trips), "database: its trips are trips.csv's")
DBI::dbDisconnect(con)

if (length(failures)) {
  cat(sprintf("\n%d check(s) failed\n", length(failures)))
  quit(status = 1)
}
cat("\nall checks passed\n")
