# Larkhaven Bikes: the city every lesson's data comes from.
#
# Larkhaven is a fictional lakeside city. Its bike-share scheme opened in April 2021 and has grown
# every year since. This script generates all of the scheme's data from one fixed seed, so the same
# R and packages always write the same bytes. The features lessons rely on are put there on
# purpose: a duplicated station ID, trips across both daylight-saving changes, sensor gaps and -99
# readings, a column that fails to parse in every monthly export, dates stored as Excel serial
# numbers. check.R confirms each one is there.
#
#   Rscript generate.R <out-dir>
#
# <out-dir> receives every file. content/world/data/ in the repository holds the small ones,
# committed so changes can be reviewed. The runtime image runs this script into /opt/lab/world and
# fails to build if its small files differ from the committed ones. The two big ones, trips.csv and
# the archive, exist only in the image; each run's project links to them.
#
# The city keeps local time (America/Toronto), and its systems export local wall-clock times without
# an offset, as many real ones do. So 2:00-2:59 am never appears on 9 March 2025 and 1:00-1:59 am
# appears twice on 2 November 2025.
args <- commandArgs(trailingOnly = TRUE)
if (length(args) != 1L) stop("usage: Rscript generate.R <out-dir>")
out <- args[[1]]
suppressPackageStartupMessages({
  library(dplyr)
  library(readr)
  library(tidyr)
})
options(dplyr.summarise.inform = FALSE)
invisible(Sys.setlocale("LC_COLLATE", "C"))
set.seed(20250415)
tz <- "America/Toronto"
for (d in c("", "exports", "feed", "site")) dir.create(file.path(out, d), recursive = TRUE, showWarnings = FALSE)

local_time <- function(x) format(x, "%Y-%m-%d %H:%M:%S", tz = tz)
write <- function(df, name) write_csv(df, file.path(out, name), na = "")
pick <- function(x, n, prob = NULL) x[sample.int(length(x), n, replace = TRUE, prob = prob)]

# ---------- Neighbourhoods and stations ----------
# Offsets of each neighbourhood's centre from Market Square, in km (east, north), and its role:
# where people live, where they work and study, or where they go for fun.
hoods <- tribble(
  ~neighbourhood, ~east, ~north, ~role,
  "Market Square", 0.0, 0.0, "centre",
  "Old Harbour", 0.4, -1.6, "leisure",
  "Castle Hill", -1.6, 0.4, "mixed",
  "University", 1.3, 1.5, "centre",
  "Millbrook", -3.0, 2.5, "residential",
  "Northgate", 0.3, 3.4, "residential",
  "Eastfield", 3.4, 0.6, "residential",
  "Riverside", 2.0, -1.2, "mixed",
  "Fenwick Park", -2.2, -1.5, "leisure",
  "Westmoor", -4.3, -0.4, "residential",
  "Saltings", 1.7, -2.6, "residential"
)

# Station names as the operator's registry holds them, untidied: "St." and "St", "&" and "and",
# capitals, lower case, a double space and a curly apostrophe are all real-world texture.
stations <- tribble(
  ~station_id, ~name, ~neighbourhood, ~opened, ~former_name,
  101, "Market Square", "Market Square", "2021-04-15", NA,
  102, "MARKET SQUARE NORTH", "Market Square", "2021-04-15", NA,
  103, "Town Hall", "Market Square", "2021-04-15", NA,
  104, "Bridge St & Water St", "Market Square", "2021-04-15", NA,
  105, "Larkhaven Central Station", "Market Square", "2021-04-15", NA,
  106, "Corn Exchange", "Market Square", "2021-04-15", NA,
  107, "Library Plaza", "Market Square", "2021-04-15", NA,
  108, "Bellfounders Row", "Market Square", "2021-04-15", NA,
  109, "St. Agnes Square", "Market Square", "2021-04-15", NA,
  110, "Guildhall Lane", "Market Square", "2021-04-15", NA,
  111, "Theatre Royal", "Market Square", "2021-04-15", NA,
  112, "Courthouse", "Market Square", "2022-05-01", NA,
  113, "Harbour Front", "Old Harbour", "2021-04-15", NA,
  114, "Ferry Landing", "Old Harbour", "2021-04-15", NA,
  115, "Cooper’s Wharf", "Old Harbour", "2021-04-15", NA,
  116, "Harbour Master", "Old Harbour", "2021-04-15", NA,
  117, "Quay Street", "Old Harbour", "2021-04-15", NA,
  117, "Quay Street (temporary)", "Old Harbour", "2025-05-01", NA,
  118, "Chandlers Court", "Old Harbour", "2021-04-15", NA,
  119, "Lighthouse Walk", "Old Harbour", "2021-04-15", NA,
  120, "Boatyard", "Old Harbour", "2022-05-01", NA,
  121, "Ropewalk", "Old Harbour", "2021-04-15", NA,
  122, "Castle  Gate", "Castle Hill", "2021-04-15", NA,
  123, "Castle Hill Park", "Castle Hill", "2021-04-15", NA,
  124, "St Agnes Church", "Castle Hill", "2021-04-15", NA,
  125, "Keep Street", "Castle Hill", "2021-04-15", NA,
  126, "Barbican", "Castle Hill", "2021-04-15", NA,
  127, "Mill Rd and Kiln St", "Castle Hill", "2021-04-15", NA,
  128, "Tanner's Yard", "Castle Hill", "2021-04-15", NA,
  129, "Gasworks Yard", "Castle Hill", "2021-04-15", "Gasworks Lane",
  130, "university library", "University", "2021-04-15", NA,
  131, "Science Park", "University", "2021-04-15", NA,
  132, "Student Union", "University", "2021-04-15", NA,
  133, "University West", "University", "2021-04-15", "Teachers' College",
  134, "Engineering Quad", "University", "2021-04-15", NA,
  135, "Medical School", "University", "2021-04-15", NA,
  136, "Residences North", "University", "2021-04-15", NA,
  137, "Sports Centre", "University", "2021-04-15", NA,
  138, "Observatory Road", "University", "2022-05-01", NA,
  139, "Millbrook Green", "Millbrook", "2022-05-01", NA,
  140, "Millbrook Shops", "Millbrook", "2022-05-01", NA,
  141, "Weir Lane", "Millbrook", "2022-05-01", NA,
  142, "Ash Grove", "Millbrook", "2022-05-01", NA,
  143, "Elm Terrace", "Millbrook", "2022-05-01", NA,
  144, "Pinfold Street", "Millbrook", "2022-05-01", NA,
  145, "Millbrook School", "Millbrook", "2022-05-01", NA,
  146, "Orchard Close", "Millbrook", "2022-05-01", NA,
  147, "Northgate Library", "Northgate", "2022-05-01", NA,
  148, "Northgate Junction", "Northgate", "2022-05-01", NA,
  149, "Hospital", "Northgate", "2022-05-01", NA,
  150, "Foundry Road", "Northgate", "2022-05-01", NA,
  151, "Northgate Pool", "Northgate", "2022-05-01", NA,
  152, "Hatter's Lane", "Northgate", "2022-05-01", NA,
  153, "Ridgeway", "Northgate", "2022-05-01", NA,
  154, "Birch Avenue", "Northgate", "2022-05-01", NA,
  155, "Eastfield Shops", "Eastfield", "2023-04-15", NA,
  156, "Eastfield Station", "Eastfield", "2023-04-15", NA,
  157, "Brickworks", "Eastfield", "2023-04-15", NA,
  158, "Cedar Road", "Eastfield", "2023-04-15", NA,
  159, "Linden Way", "Eastfield", "2023-04-15", NA,
  160, "Eastfield Community Centre", "Eastfield", "2023-04-15", NA,
  161, "Maple Crescent", "Eastfield", "2023-04-15", NA,
  162, "Rowan Street", "Eastfield", "2023-04-15", NA,
  163, "Riverside Walk", "Riverside", "2021-04-15", NA,
  164, "Boathouse", "Riverside", "2021-04-15", NA,
  165, "Willow Bank", "Riverside", "2021-04-15", NA,
  166, "Lock Keeper's Cottage", "Riverside", "2021-04-15", NA,
  167, "Riverside Market", "Riverside", "2023-04-15", NA,
  168, "Old Tannery", "Riverside", "2023-04-15", NA,
  169, "Canal Basin", "Riverside", "2023-04-15", NA,
  170, "Towpath North", "Riverside", "2023-04-15", NA,
  171, "Fenwick Park Gates", "Fenwick Park", "2024-05-01", NA,
  172, "Lido", "Fenwick Park", "2024-05-01", NA,
  173, "Bandstand", "Fenwick Park", "2024-05-01", NA,
  174, "Rose Garden", "Fenwick Park", "2024-05-01", NA,
  175, "Westmoor Road", "Westmoor", "2024-05-01", NA,
  176, "Westmoor Farm Shop", "Westmoor", "2024-05-01", NA,
  177, "Heathfield", "Westmoor", "2024-05-01", NA,
  178, "Westmoor Commons", "Westmoor", "2024-05-01", NA,
  179, "Saltings Wharf", "Saltings", "2026-03-01", NA,
  180, "Saltings Lane", "Saltings", "2024-06-01", NA
) |>
  mutate(station_id = as.integer(station_id), opened = as.Date(opened))
# Gasworks Lane became Gasworks Yard on 1 April 2025, and Teachers' College became University West
# on 1 June 2025. Saltings Lane closed for works on 15 October 2024 and stayed closed all of 2025;
# Saltings Wharf opens in 2026. So two stations have no trips in 2025.
renamed_on <- c(`129` = "2025-04-01", `133` = "2025-06-01")
closed <- list(station_id = 180L, from = as.Date("2024-10-15"))

centre <- c(lat = 44.705, lon = -79.87)
km_lat <- 1 / 111.2
km_lon <- 1 / (111.2 * cos(centre[["lat"]] * pi / 180))
stations <- stations |>
  left_join(hoods, by = "neighbourhood") |>
  mutate(
    lat = round(centre[["lat"]] + (north + rnorm(n(), 0, 0.45)) * km_lat, 5),
    lon = round(centre[["lon"]] + (east + rnorm(n(), 0, 0.45)) * km_lon, 5),
    docks = as.integer(case_when(
      role == "centre" ~ sample(20:35, n(), replace = TRUE),
      role == "leisure" ~ sample(15:27, n(), replace = TRUE),
      .default = sample(11:19, n(), replace = TRUE)
    ))
  )

# One row per ID for generating trips (the temporary Quay Street shares its ID with the old one).
sites <- stations |> distinct(station_id, .keep_all = TRUE) |> arrange(station_id)
n_sites <- nrow(sites)
pop <- c(centre = 1.5, leisure = 1.0, mixed = 1.0, residential = 0.85)[sites$role] * exp(rnorm(n_sites, 0, 0.3))
pop[sites$name %in% c("Market Square", "Larkhaven Central Station")] <- pop[sites$name %in% c("Market Square", "Larkhaven Central Station")] * 1.7
pop[sites$neighbourhood == "Saltings"] <- 0.4
haversine <- function(lat1, lon1, lat2, lon2) {
  rad <- pi / 180
  a <- sin((lat2 - lat1) * rad / 2)^2 + cos(lat1 * rad) * cos(lat2 * rad) * sin((lon2 - lon1) * rad / 2)^2
  2 * 6371 * asin(sqrt(a))
}
dist <- outer(seq_len(n_sites), seq_len(n_sites), function(i, j) haversine(sites$lat[i], sites$lon[i], sites$lat[j], sites$lon[j]))

# ---------- Bikes ----------
# Bought in batches each spring. The first batch of classic bikes kept the old numbering (LB00042)
# for a few that are still in service; every other ID says the type: LB-C-00123, LB-E-00045.
batches <- tribble(
  ~bike_type, ~model, ~in_service, ~n,
  "classic", "Kestrel 1", "2021-04-01", 210,
  "electric", "Swift E1", "2021-04-01", 80,
  "classic", "Kestrel 2", "2022-04-04", 90,
  "electric", "Swift E1", "2022-04-04", 60,
  "classic", "Kestrel 2", "2023-04-03", 70,
  "electric", "Swift E2", "2023-04-03", 60,
  "classic", "Kestrel 3", "2024-04-08", 50,
  "electric", "Swift E2", "2024-04-08", 70
)
bikes <- batches |>
  uncount(n) |>
  mutate(in_service = as.Date(in_service)) |>
  mutate(number = row_number(), .by = bike_type) |>
  mutate(bike_id = sprintf("LB-%s-%05d", if_else(bike_type == "electric", "E", "C"), number))
legacy <- which(bikes$model == "Kestrel 1")[c(3, 17, 29, 44, 58, 71, 86, 99, 120, 133, 151, 188)]
bikes$bike_id[legacy] <- sprintf("LB%05d", bikes$number[legacy])
bikes <- bikes |> select(bike_id, bike_type, model, in_service)

# ---------- Weather (the true hourly readings; the file gets gaps and sentinels later) ----------
hours <- seq(as.POSIXct("2021-04-15 00:00:00", tz = tz), as.POSIXct("2025-12-31 23:00:00", tz = tz), by = "hour")
lt <- as.POSIXlt(hours)
doy <- lt$yday
hr <- lt$hour
year <- lt$year + 1900L
season_wave <- sin(2 * pi * (doy - 110) / 365.25)
temp <- 7.5 + 14.5 * season_wave + (3 + 2 * season_wave) * sin(2 * pi * (hr - 9) / 24) +
  as.numeric(stats::filter(rnorm(length(hours), 0, 0.55), 0.985, method = "recursive"))
days <- as.Date(format(hours, "%Y-%m-%d", tz = tz))
day_index <- as.integer(days - min(days)) + 1L
wet_day <- logical(max(day_index))
for (i in seq_along(wet_day)[-1]) wet_day[i] <- runif(1) < if (wet_day[i - 1]) 0.5 else 0.22
raining <- wet_day[day_index] & as.numeric(stats::filter(runif(length(hours)), rep(1 / 3, 3), sides = 1, circular = TRUE)) > 0.55
rain <- ifelse(raining, rgamma(length(hours), shape = 0.8, scale = 1.6), 0)
wind <- pmax(0, as.numeric(stats::filter(rgamma(length(hours), 4, scale = 3.5), rep(1 / 4, 4), sides = 1, circular = TRUE)) + 6 * raining)
weather_true <- tibble(time = hours, temp_c = round(temp, 1), rain_mm = round(rain, 1), wind_kmh = round(wind))

# ---------- Trips ----------
# Expected trips per hour, for members (commuting peaks on weekdays) and casual riders (afternoons,
# weekends and summer), scaled by the year's growth, the stations open, the season and the weather.
nth_monday <- function(y, m, n) {
  first <- as.Date(sprintf("%d-%02d-01", y, m))
  first + ((8 - as.integer(format(first, "%u"))) %% 7) + 7 * (n - 1)
}
holidays <- do.call(c, lapply(2021:2025, function(y) c(
  as.Date(sprintf("%d-01-01", y)), nth_monday(y, 2, 3),
  as.Date(sprintf("%d-05-24", y)) - ((as.integer(format(as.Date(sprintf("%d-05-24", y)), "%u")) - 1) %% 7),
  as.Date(sprintf("%d-07-01", y)), nth_monday(y, 8, 1), nth_monday(y, 9, 1), nth_monday(y, 10, 2),
  as.Date(sprintf("%d-12-25", y)), as.Date(sprintf("%d-12-26", y))
)))
weekend <- lt$wday %in% c(0L, 6L) | days %in% holidays
profile <- list(
  member_weekday = c(0.05, 0.03, 0.02, 0.02, 0.04, 0.15, 0.55, 1.6, 2.4, 1.1, 0.6, 0.65, 0.85, 0.8, 0.7, 0.85, 1.5, 2.3, 1.6, 0.95, 0.65, 0.45, 0.28, 0.12),
  member_weekend = c(0.12, 0.08, 0.05, 0.03, 0.03, 0.05, 0.12, 0.25, 0.45, 0.7, 0.95, 1.1, 1.2, 1.2, 1.15, 1.1, 1.0, 0.9, 0.75, 0.6, 0.45, 0.35, 0.25, 0.15),
  casual_weekday = c(0.06, 0.04, 0.02, 0.02, 0.02, 0.04, 0.1, 0.25, 0.35, 0.4, 0.55, 0.75, 0.9, 0.95, 1.0, 1.05, 1.1, 1.2, 1.15, 1.0, 0.8, 0.55, 0.35, 0.15),
  casual_weekend = c(0.12, 0.08, 0.05, 0.03, 0.02, 0.03, 0.08, 0.2, 0.45, 0.9, 1.4, 1.9, 2.2, 2.3, 2.3, 2.2, 2.0, 1.7, 1.4, 1.1, 0.8, 0.55, 0.35, 0.2)
)
# Which stations are open changes on a few dates; each span between them is one version.
changes <- sort(unique(c(sites$opened, closed$from)))
open_at <- function(date) {
  open <- sites$opened <= date
  open[sites$station_id == closed$station_id & date >= closed$from] <- FALSE
  open
}
version <- findInterval(days, changes)
versions <- lapply(seq_along(changes), function(v) open_at(changes[[v]]))
network <- vapply(versions, function(open) sum(pop[open]), numeric(1)) / sum(pop[open_at(as.Date("2025-06-30"))])
adoption <- c(`2021` = 0.42, `2022` = 0.66, `2023` = 0.82, `2024` = 0.93, `2025` = 1.0)[as.character(year)]
season <- 0.7 + 0.3 * sin(2 * pi * (doy - 105) / 365.25)
weather_f <- plogis((temp + 6) / 6) * (1 - 0.35 * plogis((temp - 29) / 2)) * exp(-0.75 * rain) * exp(-0.012 * pmax(0, wind - 18))
base <- adoption * network[version]
lambda_m <- base * season^0.8 * weather_f * ifelse(weekend, profile$member_weekend[hr + 1], profile$member_weekday[hr + 1])
lambda_c <- base * season^1.6 * weather_f^1.4 * ifelse(weekend, profile$casual_weekend[hr + 1], profile$casual_weekday[hr + 1])
in_2025 <- year == 2025L
lambda_m <- lambda_m * 98000 / sum(lambda_m[in_2025])
lambda_c <- lambda_c * 52000 / sum(lambda_c[in_2025])
n_m <- rpois(length(hours), lambda_m)
n_c <- rpois(length(hours), lambda_c)

hour_of <- c(rep(seq_along(hours), n_m), rep(seq_along(hours), n_c))
member_type <- rep(c("member", "casual"), c(sum(n_m), sum(n_c)))
n <- length(hour_of)
start_abs <- as.numeric(hours)[hour_of] + floor(runif(n, 0, 3600))
tod <- ifelse(weekend[hour_of], "off", ifelse(hr[hour_of] %in% 6:9, "am", ifelse(hr[hour_of] %in% 15:18, "pm", "off")))
trip_version <- version[hour_of]

# Start and end stations. Mornings run from homes to the centre and evenings back; casual riders
# favour the harbour, the park and the centre. Most trips are short.
role_weight <- function(who, end, when) {
  w <- if (who == "casual") {
    c(centre = 1.3, leisure = 2.6, mixed = 1.0, residential = 0.55)
  } else if (when == "am") {
    if (end) c(centre = 2.3, leisure = 0.6, mixed = 1.0, residential = 0.5) else c(centre = 0.7, leisure = 0.6, mixed = 1.0, residential = 2.0)
  } else if (when == "pm") {
    if (end) c(centre = 0.7, leisure = 0.8, mixed = 1.1, residential = 2.0) else c(centre = 1.9, leisure = 0.8, mixed = 1.1, residential = 0.7)
  } else {
    c(centre = 1.0, leisure = 1.1, mixed = 1.0, residential = 1.0)
  }
  w[sites$role]
}
start_station <- integer(n)
for (g in split(seq_len(n), list(trip_version, member_type, tod), drop = TRUE)) {
  i <- g[[1]]
  w <- pop * role_weight(member_type[i], FALSE, tod[i]) * versions[[trip_version[i]]]
  start_station[g] <- sample.int(n_sites, length(g), replace = TRUE, prob = w)
}
round_trip <- runif(n) < ifelse(member_type == "casual", 0.12, 0.02)
end_station <- start_station
others <- which(!round_trip)
for (g in split(others, list(trip_version[others], member_type[others], tod[others], start_station[others]), drop = TRUE)) {
  i <- g[[1]]
  w <- pop * role_weight(member_type[i], TRUE, tod[i]) * versions[[trip_version[i]]] *
    exp(-dist[start_station[i], ] / if (member_type[i] == "casual") 2.8 else 2.0)
  w[start_station[i]] <- 0
  end_station[g] <- sample.int(n_sites, length(g), replace = TRUE, prob = w)
}

# The bike, its type and how far and fast it went. E-bikes are faster; casual riders stop on the way.
trip_day <- days[hour_of]
e_share <- c(`2021` = 0.25, `2022` = 0.3, `2023` = 0.34, `2024` = 0.38, `2025` = 0.4)[as.character(year[hour_of])]
bike_type <- ifelse(runif(n) < e_share + ifelse(member_type == "casual", 0.05, 0), "electric", "classic")
bike_id <- character(n)
fleet_version <- findInterval(trip_day, sort(unique(bikes$in_service)))
for (g in split(seq_len(n), list(bike_type, fleet_version), drop = TRUE)) {
  i <- g[[1]]
  pool <- bikes$bike_id[bikes$bike_type == bike_type[i] & bikes$in_service <= trip_day[i]]
  bike_id[g] <- pick(pool, length(g))
}
distance <- ifelse(round_trip, rgamma(n, shape = 2.2, scale = 1.8) + 0.3,
  dist[cbind(start_station, end_station)] * (1.25 + pmin(0.75, rexp(n, 1 / 0.12))))
speed <- pmax(6, ifelse(bike_type == "electric",
  ifelse(member_type == "member", rnorm(n, 19.5, 3), rnorm(n, 17, 3.2)),
  ifelse(member_type == "member", rnorm(n, 14, 2.5), rnorm(n, 11.5, 2.8))))
minutes <- distance / speed * 60 + rexp(n, 1 / 1.2) + ifelse(member_type == "casual" & runif(n) < 0.35, rexp(n, 1 / 9), 0)
duration_s <- round(minutes * 60)
distance_km <- round(distance, 2)
end_known <- rep(TRUE, n)

# Faults, as the operator's systems record them. False starts: undocked and docked again at once.
# Clock errors: the dock's clock was behind. Lost bikes: recovered days later, end and distance
# unknown. Dock faults: the bike was returned but no dock recorded it.
faults <- sample(c("none", "false_start", "clock", "lost", "dock"), n, replace = TRUE, prob = c(0.9936, 0.0003, 0.0002, 0.0004, 0.0055))
f <- faults == "false_start"
duration_s[f] <- 0
end_station[f] <- start_station[f]
distance_km[f] <- 0
f <- faults == "clock"
duration_s[f] <- -round(runif(sum(f), 60, 3600))
f <- faults == "lost"
duration_s[f] <- round(runif(sum(f), 1440, 13000) * 60)
end_known[f] <- FALSE
distance_km[f] <- NA
end_known[faults == "dock"] <- FALSE

trips <- tibble(
  start_abs = start_abs, end_abs = start_abs + duration_s, bike_id, start_station = sites$station_id[start_station],
  end_station = if_else(end_known, sites$station_id[end_station], NA_integer_), member_type, bike_type, distance_km,
  duration_min = round(duration_s / 60, 1)
)
# Trips across the 2025 daylight-saving changes, so lessons can count on them. Local clock times:
# 01:41 to 03:07 on 9 March is 26.4 minutes; 01:38 to 01:12 on 2 November is 34.5 minutes.
dst_trips <- tibble(
  start_abs = as.numeric(as.POSIXct(c("2025-03-09 06:41:07", "2025-03-09 06:52:30", "2025-11-02 05:38:12", "2025-11-02 05:51:40"), tz = "UTC")),
  duration_min = c(26.4, 31.0, 34.5, 28.2),
  bike_id = c("LB-E-00112", "LB-C-00207", "LB-E-00031", "LB-C-00118"),
  start_station = c(105L, 113L, 101L, 132L), end_station = c(149L, 101L, 156L, 105L),
  member_type = c("member", "casual", "member", "casual"), bike_type = c("electric", "classic", "electric", "classic"),
  distance_km = c(5.71, 4.12, 6.48, 3.06)
) |> mutate(end_abs = start_abs + duration_min * 60)
trips <- bind_rows(trips, dst_trips) |>
  arrange(start_abs, bike_id) |>
  mutate(
    trip_id = row_number(),
    started_at = local_time(as.POSIXct(start_abs, tz = tz)),
    ended_at = local_time(as.POSIXct(end_abs, tz = tz))
  )
trips_out <- trips |>
  select(trip_id, bike_id, started_at, ended_at, start_station, end_station, member_type, bike_type, distance_km, duration_min)
trips_2025 <- trips_out |> filter(startsWith(started_at, "2025-"))
write(trips_2025, "trips.csv")

# One week of complete trips, Monday 2 to Sunday 8 June 2025: small enough to chart trip by trip
# (lesson 1). It leaves out the trips the operator's systems recorded wrongly: no end dock (lost
# bikes and dock faults) or a duration of zero or less (false starts and clock errors).
trips_week <- trips_2025 |>
  filter(started_at >= "2025-06-02", started_at < "2025-06-09", !is.na(end_station), duration_min > 0)
write(trips_week, "trips-week.csv")

# The archive: every trip since the scheme opened, as Parquet files partitioned by year and month.
# Times are stored as they appear in trips.csv (local clock times, no time zone), so a year read from
# the archive equals the same year read from the CSV.
archive <- trips_out |>
  mutate(
    started_at = as.POSIXct(started_at, tz = "UTC"),
    ended_at = as.POSIXct(ended_at, tz = "UTC"),
    year = as.integer(substr(format(started_at, tz = "UTC"), 1, 4)),
    month = as.integer(substr(format(started_at, tz = "UTC"), 6, 7))
  )
con <- DBI::dbConnect(duckdb::duckdb(shared_home = FALSE))
invisible(DBI::dbExecute(con, "SET threads TO 1"))
duckdb::duckdb_register(con, "archive", archive)
unlink(file.path(out, "archive"), recursive = TRUE)
invisible(DBI::dbExecute(con, sprintf(
  "COPY (SELECT * FROM archive ORDER BY trip_id) TO '%s' (FORMAT parquet, PARTITION_BY (year, month), COMPRESSION zstd)",
  file.path(out, "archive")
)))
DBI::dbDisconnect(con)

# ---------- Stations, bikes and fares ----------
stations_out <- stations |>
  arrange(station_id, opened) |>
  select(station_id, name, neighbourhood, lat, lon, docks, opened, former_name)
write(stations_out, "stations.csv")
write(bikes, "bikes.csv")
fares <- tribble(
  ~member_type, ~bike_type, ~valid_from, ~valid_to, ~unlock_fee, ~per_minute,
  "casual", "classic", "2021-04-15", "2023-03-31", 1.00, 0.12,
  "casual", "electric", "2021-04-15", "2023-03-31", 1.00, 0.25,
  "member", "classic", "2021-04-15", "2023-03-31", 0.00, 0.00,
  "member", "electric", "2021-04-15", "2023-03-31", 0.00, 0.12,
  "casual", "classic", "2023-04-01", "2025-03-31", 1.25, 0.15,
  "casual", "electric", "2023-04-01", "2025-03-31", 1.25, 0.30,
  "member", "classic", "2023-04-01", "2025-03-31", 0.00, 0.00,
  "member", "electric", "2023-04-01", "2025-03-31", 0.00, 0.15,
  "casual", "classic", "2025-04-01", NA, 1.50, 0.18,
  "casual", "electric", "2025-04-01", NA, 1.50, 0.35,
  "member", "classic", "2025-04-01", NA, 0.00, 0.00,
  "member", "electric", "2025-04-01", NA, 0.00, 0.18
) |> mutate(fare_id = row_number(), .before = 1)
write(fares, "fares.csv")

# ---------- Weather file: 2025, as the city's sensor logged it ----------
# Three gaps when the sensor was offline, and -99 where it reported a fault.
weather <- weather_true |>
  filter(format(time, "%Y", tz = tz) == "2025") |>
  filter(!(time >= as.POSIXct("2025-02-11 03:00", tz = tz) & time <= as.POSIXct("2025-02-11 14:00", tz = tz))) |>
  filter(!(time >= as.POSIXct("2025-06-23 22:00", tz = tz) & time <= as.POSIXct("2025-06-25 07:00", tz = tz))) |>
  filter(!(time >= as.POSIXct("2025-09-02 10:00", tz = tz) & time <= as.POSIXct("2025-09-02 12:00", tz = tz)))
weather$temp_c[sort(sample.int(nrow(weather), 9))] <- -99
weather$wind_kmh[sort(sample.int(nrow(weather), 5))] <- -99
weather <- weather |> mutate(time = format(time, "%Y-%m-%d %H:%M", tz = tz))
write(weather, "weather.csv")

# ---------- Wide tables for tidying (lesson 5) ----------
started_2025 <- trips_2025 |>
  mutate(month = as.integer(substr(started_at, 6, 7)), hour = as.integer(substr(started_at, 12, 13)),
         weekend = as.Date(substr(started_at, 1, 10)) %in% c(holidays) | format(as.Date(substr(started_at, 1, 10)), "%u") %in% c("6", "7"))
by_id <- stations_out |> distinct(station_id, .keep_all = TRUE) |> select(station_id, name)
month_cols <- tolower(month.abb)
station_months <- started_2025 |>
  count(station_id = start_station, month) |>
  mutate(month = factor(month_cols[month], levels = month_cols)) |>
  pivot_wider(names_from = month, values_from = n, names_expand = TRUE)
write(by_id |> left_join(station_months, by = "station_id"), "station-months.csv")
station_periods <- started_2025 |>
  mutate(period = paste(if_else(weekend, "weekend", "weekday"), if_else(hour < 12, "am", "pm"), sep = "_")) |>
  count(station_id = start_station, period) |>
  pivot_wider(names_from = period, values_from = n, values_fill = 0L)
write(by_id |> select(station_id) |> inner_join(station_periods, by = "station_id") |>
  select(station_id, weekday_am, weekday_pm, weekend_am, weekend_pm), "station-periods.csv")
station_riders <- started_2025 |>
  filter(duration_min > 0, duration_min < 240) |>
  summarize(trips = n(), minutes = median(duration_min), .by = c(start_station, member_type)) |>
  pivot_wider(names_from = member_type, values_from = c(trips, minutes)) |>
  rename(station_id = start_station) |>
  arrange(station_id) |>
  select(station_id, trips_member, trips_casual, minutes_member, minutes_casual)
write(station_riders, "station-riders.csv")

# ---------- Monthly station exports (lessons 7 and 26) ----------
# As the operator's dashboard exports them: a title line above the header, column names written for
# people, three different codes for a missing value, units inside numbers, US-style dates, and in
# each file one dock-fault count that isn't a number.
missing_code <- function(k) sample(c("n/a", "-", ""), k, replace = TRUE)
for (m in 1:12) {
  month_trips <- started_2025 |> filter(month == m)
  ended <- trips_2025 |> filter(as.integer(substr(ended_at, 6, 7)) == m, startsWith(ended_at, "2025-")) |> count(station_id = end_station, name = "ended")
  name_then <- stations_out |>
    filter(opened <= as.Date(sprintf("2025-%02d-28", m))) |>
    distinct(station_id, .keep_all = TRUE) |>
    mutate(name = if_else(!is.na(former_name) & as.Date(sprintf("2025-%02d-01", m)) < as.Date(renamed_on[as.character(station_id)]), former_name, name))
  export <- month_trips |>
    summarize(
      started = n(),
      distance = mean(distance_km, na.rm = TRUE),
      duration = mean(duration_min[duration_min > 0 & duration_min < 240]),
      e_share = mean(bike_type == "electric"),
      .by = start_station
    ) |>
    rename(station_id = start_station) |>
    inner_join(name_then |> select(station_id, name, neighbourhood), by = "station_id") |>
    left_join(ended, by = "station_id") |>
    arrange(station_id)
  k <- nrow(export)
  faults_n <- as.character(rpois(k, 0.6))
  faults_n[sample.int(k, 1)] <- sample(c("2 (est.)", "see log", "3?"), 1)
  inspected <- format(as.Date(sprintf("2025-%02d-01", m)) + sample(0:27, k, replace = TRUE), "%m/%d/%Y")
  file <- tibble(
    `Station ID` = export$station_id,
    `Station Name` = export$name,
    `Neighbourhood` = export$neighbourhood,
    `Trips Started` = export$started,
    `Trips Ended` = coalesce(export$ended, 0L),
    `Avg Trip Distance` = sprintf("%.2f km", export$distance),
    `Avg Duration (min)` = sprintf("%.1f", export$duration),
    `E-bike Share` = sprintf("%.0f%%", 100 * export$e_share),
    `Dock Faults` = faults_n,
    `Last Inspected` = inspected
  )
  few <- export$started < 5
  file$`Avg Duration (min)`[few] <- missing_code(sum(few))
  for (col in c("Avg Duration (min)", "E-bike Share", "Dock Faults", "Last Inspected")) {
    gaps <- setdiff(sample.int(k, 3), which(file$`Dock Faults` %in% c("2 (est.)", "see log", "3?")))
    file[[col]][gaps] <- missing_code(length(gaps))
  }
  # Every file uses all three codes somewhere.
  codes <- c("n/a", "-", "")
  file$`Last Inspected`[seq_along(codes)] <- codes
  path <- file.path(out, "exports", sprintf("station-activity-2025-%02d.csv", m))
  write_lines(sprintf("Larkhaven Bikes - station activity - %s 2025", month.name[m]), path)
  write_csv(file, path, na = "", append = TRUE, col_names = TRUE)
}

# ---------- The survey (lessons 5, 14-16) ----------
n_resp <- 1500
resp_member <- sample(c("member", "casual"), n_resp, replace = TRUE, prob = c(0.62, 0.38))
age_levels <- c("Under 16", "16-24", "25-34", "35-44", "45-54", "55-64", "65+")
age_band <- ifelse(resp_member == "member",
  pick(age_levels, n_resp, c(0.005, 0.16, 0.3, 0.24, 0.15, 0.1, 0.045)),
  pick(age_levels, n_resp, c(0.02, 0.26, 0.24, 0.17, 0.13, 0.11, 0.07)))
age_band[sample.int(n_resp, 30)] <- NA
home <- pick(c(hoods$neighbourhood, "Outside Larkhaven"), n_resp,
  c(0.08, 0.06, 0.11, 0.1, 0.13, 0.13, 0.12, 0.1, 0.03, 0.02, 0.008, 0.06))
satisfaction_levels <- c("Very dissatisfied", "Dissatisfied", "Neutral", "Satisfied", "Very satisfied")
satisfaction <- ifelse(resp_member == "member",
  pick(satisfaction_levels, n_resp, c(0.04, 0.08, 0.16, 0.45, 0.27)),
  pick(satisfaction_levels, n_resp, c(0.07, 0.12, 0.24, 0.38, 0.19)))
agree_levels <- c("Strongly disagree", "Disagree", "Neither agree nor disagree", "Agree", "Strongly agree", "Don't know")
agree <- function(prob) {
  x <- pick(agree_levels, n_resp, prob)
  x[sample.int(n_resp, 25)] <- NA
  x
}
uses <- c("commuting", "errands", "leisure", "exercise", "visiting")
use_prob <- rbind(member = c(0.72, 0.45, 0.4, 0.3, 0.06), casual = c(0.15, 0.3, 0.75, 0.35, 0.3))
use <- sapply(seq_along(uses), function(j) runif(n_resp) < use_prob[resp_member, j])
none <- rowSums(use) == 0
use[cbind(which(none), ifelse(resp_member[none] == "member", 1L, 3L))] <- TRUE
rides <- ifelse(resp_member == "member", rpois(n_resp, 4) + 1L, rpois(n_resp, 0.8))
rides[sample.int(n_resp, 40)] <- NA

# Each comment's tone follows the respondent's satisfaction: a happy rider praises, an unhappy one
# complains, and the middle ground makes a suggestion.
opening <- list(
  good = c(
    "Love the e-bikes", "Great way to get to class", "Cheaper than parking downtown", "Used it every day this summer",
    "Took the kids to the Lido, they loved it", "Rode from the harbour to the café at {station}", "Best thing the city has done in years",
    "Visiting from Montréal, very easy to use", "My daughter Zoë uses it for school", "Customer service sorted my refund quickly",
    "Lovely ride along the towpath", "Winter riding is cold but the bikes are fine", "The new docks at {station} are a big help"
  ),
  middle = c(
    "Please add more docks at {station}", "Would ride more if there were stations in Saltings", "Need a station near the hospital entrance",
    "Wish the e-bike price was lower", "A bit naïve of me but I didn't know members ride classic bikes free", "The map in the app is out of date",
    "Saddles are too high and hard to lower", "Could the app show how many e-bikes are charged?"
  ),
  bad = c(
    "The app keeps logging me out", "{station} is always full by 8:30", "{station} is always empty after work",
    "Brakes on the classic bikes need attention", "The bike lanes on Bridge St feel unsafe", "Docking sometimes fails and I get charged",
    "Electric bikes are always flat by the evening", "Too many bikes left outside docks at {station}"
  )
)
closing <- list(
  good = c("", "", " Thanks!", " Keep it up.", " Would recommend."),
  middle = c("", "", " Thanks.", " Otherwise fine."),
  bad = c("", "", " Please fix this.", " Not happy.", " Hope this gets sorted.")
)
emoji <- list(good = c(" \U0001F6B2", " \U0001F44D", " ❤️", " \U0001F60A"), middle = c(" \U0001F914", " \U0001F6B2"), bad = c(" \U0001F621", " \U0001F44E"))
promo <- c("LARK-SPRING25", "LARK-FRIEND-0417", "STUDENT25", "LARK-SUMMER25", "WELCOME10")
comment <- rep(NA_character_, n_resp)
has <- which(runif(n_resp) < 0.45)
tone <- ifelse(satisfaction %in% c("Satisfied", "Very satisfied"), "good", ifelse(satisfaction == "Neutral", "middle", "bad"))
tone[has] <- ifelse(runif(length(has)) < 0.15, "middle", tone[has]) # happy riders still make suggestions
station_mentions <- c(sites$name, "market sq", "Quay St", "the Lido", "central station")
comment[has] <- vapply(has, function(i) {
  text <- sub("{station}", pick(station_mentions, 1), pick(opening[[tone[i]]], 1), fixed = TRUE)
  end <- if (endsWith(text, "?")) "" else pick(c(".", ".", "!", ""), 1)
  closer <- pick(closing[[tone[i]]], 1)
  if (end == "" && nzchar(closer)) end <- "."
  paste0(text, end, closer)
}, character(1))
with_code <- sample(has, 60)
comment[with_code] <- paste0(comment[with_code], " Used code ", pick(promo, length(with_code)), pick(c(" at sign-up.", ", worked fine.", " for my first month.", "."), length(with_code)))
shout <- sample(has, 25)
comment[shout] <- toupper(comment[shout])
quiet <- sample(setdiff(has, shout), 90)
comment[quiet] <- tolower(comment[quiet])
smile <- sample(has, 70)
comment[smile] <- paste0(comment[smile], vapply(smile, function(i) pick(emoji[[tone[i]]], 1), character(1)))
survey <- tibble(
  response_id = seq_len(n_resp),
  submitted = format(as.POSIXct("2025-10-06 07:00", tz = tz) + sort(runif(n_resp, 0, 20 * 86400)), "%Y-%m-%d %H:%M", tz = tz),
  member_type = resp_member,
  age_band,
  home_neighbourhood = home,
  rides_per_week = rides,
  satisfaction,
  agree_ebikes_worth_price = agree(c(0.1, 0.2, 0.22, 0.28, 0.14, 0.06)),
  agree_feel_safe = agree(c(0.06, 0.14, 0.2, 0.38, 0.18, 0.04)),
  agree_enough_docks = agree(c(0.14, 0.26, 0.2, 0.26, 0.1, 0.04)),
  !!!setNames(lapply(seq_along(uses), function(j) if_else(use[, j], "Yes", NA_character_)), paste0("use_", uses)),
  comment
)
write(survey, "survey.csv")

# ---------- The maintenance workbook (lessons 18 and 20) ----------
# As the depots keep it: a summary sheet whose Depot column is filled in only on each block's first
# row, then one sheet per depot with two title rows above the header, dates as Excel serial numbers
# (no date format), notes typed into the Minutes column and a total row at the bottom.
depots <- c("Northgate", "Harbour", "Eastfield")
mechanics <- list(Northgate = c("Priya", "Tomasz", "Ama"), Harbour = c("Luis", "Mei"), Eastfield = c("Jonah", "Farah", "Kwame"))
fault_types <- c("Flat tyre", "Brakes", "Chain", "Lights", "Dock lock", "Saddle", "Bell", "Frame damage", "Battery")
excel_serial <- function(d) as.numeric(d - as.Date("1899-12-30"))
logs <- lapply(depots, function(depot) {
  k <- c(Northgate = 142, Harbour = 118, Eastfield = 131)[[depot]]
  bike <- pick(bikes$bike_id, k)
  is_e <- grepl("-E-", bike, fixed = TRUE)
  fault <- ifelse(is_e & runif(k) < 0.35, "Battery", pick(fault_types[-9], k, c(0.24, 0.2, 0.14, 0.12, 0.1, 0.08, 0.05, 0.07)))
  minutes <- as.character(round(rgamma(k, 3, scale = 12)))
  minutes[sample.int(k, 3)] <- c("approx 40", "see notes", "45?")
  parts <- ifelse(fault %in% c("Flat tyre", "Bell", "Saddle", "Lights") & runif(k) < 0.5, NA, round(rgamma(k, 2, scale = 14), 2))
  parts_txt <- ifelse(is.na(parts), pick(c("", "N/A", "-"), k), NA)
  notes <- ifelse(runif(k) < 0.12, pick(c("Waiting on parts", "Rider reported via app", "Returned to service same day", "Sent to Harbour depot", "Recurring fault"), k), "")
  tibble(
    date = sort(as.Date("2025-01-02") + sample(0:362, k, replace = TRUE)), bike, fault,
    mechanic = pick(mechanics[[depot]], k), minutes, parts, parts_txt, notes
  )
})
names(logs) <- depots
cell <- function(x) if (is.null(x) || (length(x) == 1 && is.na(x)) || identical(x, "")) NULL else x
summary_rows <- list(list("Depot", "Month", "Repairs", "Hours"))
for (depot in depots) {
  by_month <- logs[[depot]] |>
    mutate(month = as.integer(format(date, "%m")), mins = suppressWarnings(as.numeric(minutes))) |>
    summarize(repairs = n(), hours = round(sum(mins, na.rm = TRUE) / 60, 1), .by = month) |>
    complete(month = 1:12, fill = list(repairs = 0L, hours = 0)) |>
    arrange(month)
  for (i in seq_len(nrow(by_month))) {
    summary_rows[[length(summary_rows) + 1]] <- list(if (i == 1) depot else NULL, month.name[by_month$month[i]], by_month$repairs[i], by_month$hours[i])
  }
}
depot_sheet <- function(depot) {
  log <- logs[[depot]]
  rows <- list(
    list(sprintf("Larkhaven Bikes - %s depot", depot)),
    list("Repair log, January to December 2025 (exported from FleetDesk)"),
    list(),
    list("Date", "Bike", "Fault", "Mechanic", "Minutes", "Parts (CAD)", "Notes")
  )
  for (i in seq_len(nrow(log))) {
    m <- log$minutes[i]
    rows[[length(rows) + 1]] <- list(
      excel_serial(log$date[i]), log$bike[i], log$fault[i], log$mechanic[i],
      if (grepl("^[0-9]+$", m)) as.numeric(m) else m,
      if (is.na(log$parts[i])) cell(log$parts_txt[i]) else log$parts[i],
      cell(log$notes[i])
    )
  }
  total <- sum(suppressWarnings(as.numeric(log$minutes)), na.rm = TRUE)
  rows[[length(rows) + 1]] <- list("Total", NULL, NULL, NULL, total, round(sum(log$parts, na.rm = TRUE), 2), NULL)
  rows
}
# A minimal SpreadsheetML workbook, written by hand so the bytes never change between runs
# (writexl stamps each file with the time it was written).
write_workbook <- function(sheets, path) {
  esc <- function(s) {
    s <- gsub("&", "&amp;", s, fixed = TRUE)
    s <- gsub("<", "&lt;", s, fixed = TRUE)
    gsub(">", "&gt;", s, fixed = TRUE)
  }
  col_letter <- function(j) LETTERS[j]
  sheet_xml <- function(rows) {
    body <- vapply(seq_along(rows), function(r) {
      cells <- vapply(seq_along(rows[[r]]), function(j) {
        v <- rows[[r]][[j]]
        ref <- paste0(col_letter(j), r)
        if (is.null(v)) return("")
        if (is.numeric(v)) return(sprintf('<c r="%s"><v>%s</v></c>', ref, format(v, digits = 15, scientific = FALSE, trim = TRUE)))
        sprintf('<c r="%s" t="inlineStr"><is><t xml:space="preserve">%s</t></is></c>', ref, esc(v))
      }, character(1))
      sprintf('<row r="%d">%s</row>', r, paste(cells, collapse = ""))
    }, character(1))
    paste0('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n',
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>',
      paste(body, collapse = ""), "</sheetData></worksheet>")
  }
  tmp <- tempfile("xlsx")
  dir.create(file.path(tmp, "_rels"), recursive = TRUE)
  dir.create(file.path(tmp, "xl", "_rels"), recursive = TRUE)
  dir.create(file.path(tmp, "xl", "worksheets"), recursive = TRUE)
  k <- length(sheets)
  ns <- 'xmlns="http://schemas.openxmlformats.org/package/2006/relationships"'
  xml_head <- '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
  files <- list(
    "[Content_Types].xml" = paste0(xml_head,
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
      '<Default Extension="xml" ContentType="application/xml"/>',
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>',
      paste(sprintf('<Override PartName="/xl/worksheets/sheet%d.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>', seq_len(k)), collapse = ""),
      "</Types>"),
    "_rels/.rels" = paste0(xml_head, "<Relationships ", ns, ">",
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>',
      "</Relationships>"),
    "xl/workbook.xml" = paste0(xml_head,
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>',
      paste(sprintf('<sheet name="%s" sheetId="%d" r:id="rId%d"/>', esc(names(sheets)), seq_len(k), seq_len(k)), collapse = ""),
      "</sheets></workbook>"),
    "xl/_rels/workbook.xml.rels" = paste0(xml_head, "<Relationships ", ns, ">",
      paste(sprintf('<Relationship Id="rId%d" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet%d.xml"/>', seq_len(k), seq_len(k)), collapse = ""),
      sprintf('<Relationship Id="rId%d" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>', k + 1),
      "</Relationships>"),
    "xl/styles.xml" = paste0(xml_head,
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
      '<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>',
      '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>',
      '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>',
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>',
      '<cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>',
      "</styleSheet>")
  )
  for (i in seq_len(k)) files[[sprintf("xl/worksheets/sheet%d.xml", i)]] <- sheet_xml(sheets[[i]])
  for (name in names(files)) writeLines(enc2utf8(files[[name]]), file.path(tmp, name), sep = "", useBytes = TRUE)
  Sys.setFileTime(file.path(tmp, names(files)), as.POSIXct("2025-12-31 00:00:00", tz = "UTC"))
  unlink(path)
  zip::zip(normalizePath(path, mustWork = FALSE), names(files), root = tmp, mode = "mirror")
  unlink(tmp, recursive = TRUE)
}
write_workbook(c(list(Summary = summary_rows), setNames(lapply(depots, depot_sheet), depots)), file.path(out, "maintenance.xlsx"))

# ---------- The station feed (lesson 23) ----------
# Shaped like GBFS 3.0, the open standard bike-share schemes publish: names as lists of
# translations, vehicle counts as a list per station, and fields that only some stations have.
snapshot <- "2025-11-14T08:30:00-05:00"
feed_sites <- stations_out |>
  filter(opened <= as.Date("2025-11-14")) |>
  group_by(station_id) |>
  slice_tail(n = 1) |>
  ungroup()
information <- lapply(seq_len(nrow(feed_sites)), function(i) {
  s <- feed_sites[i, ]
  station <- list(
    station_id = as.character(s$station_id),
    name = list(list(text = trimws(s$name), language = "en"), list(text = trimws(s$name), language = "fr")),
    lat = s$lat, lon = s$lon, capacity = s$docks
  )
  if (i %% 3 != 0) station$address <- sprintf("%d %s", 10 + (s$station_id * 7) %% 190, if (grepl("Street|Road|Lane|Row|Way|Avenue", s$name)) trimws(s$name) else "Harbour Road")
  if (i %% 5 == 0) station$rental_uris <- list(android = sprintf("larkhaven://station/%d", s$station_id), ios = sprintf("larkhaven://station/%d", s$station_id))
  station
})
status <- lapply(seq_len(nrow(feed_sites)), function(i) {
  s <- feed_sites[i, ]
  works <- s$station_id == closed$station_id
  disabled <- if (runif(1) < 0.2) sample(1:2, 1) else 0L
  bikes_here <- if (works) 0L else sample(0:max(0, s$docks - disabled - 2), 1)
  electric <- if (bikes_here) rbinom(1, bikes_here, 0.4) else 0L
  types <- list(list(vehicle_type_id = "classic", count = bikes_here - electric))
  if (electric > 0) types[[2]] <- list(vehicle_type_id = "electric", count = electric)
  station <- list(
    station_id = as.character(s$station_id), num_vehicles_available = bikes_here, vehicle_types_available = types,
    num_docks_available = s$docks - bikes_here - disabled
  )
  if (disabled) station$num_docks_disabled <- disabled
  c(station, list(is_installed = TRUE, is_renting = !works, is_returning = !works,
    last_reported = sprintf("2025-11-14T08:%02d:%02d-05:00", sample(10:29, 1), sample(0:59, 1))))
})
feed <- function(stations) list(last_updated = snapshot, ttl = 60, version = "3.0", data = list(stations = stations))
jsonlite::write_json(feed(information), file.path(out, "feed", "station_information.json"), auto_unbox = TRUE, pretty = TRUE, digits = NA)
jsonlite::write_json(feed(status), file.path(out, "feed", "station_status.json"), auto_unbox = TRUE, pretty = TRUE, digits = NA)

# ---------- The scheme's website (lesson 24) ----------
html_escape <- function(s) gsub("<", "&lt;", gsub("&", "&amp;", s, fixed = TRUE), fixed = TRUE)
page <- function(title, body) paste0(
  '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>', title, ' | Larkhaven Bikes</title>\n',
  '<link rel="stylesheet" href="style.css">\n</head>\n<body>\n<header><a href="index.html" class="brand">Larkhaven Bikes</a>\n',
  '<nav><a href="stations.html">Stations</a> <a href="fares.html">Fares</a> <a href="news.html">News</a></nav></header>\n<main>\n',
  body, "\n</main>\n<footer>Larkhaven Bikes is run by the City of Larkhaven.</footer>\n</body>\n</html>\n")
writeLines(page("Home", paste0(
  "<h1>Ride Larkhaven</h1>\n<p>Bikes and e-bikes at ", n_sites - 2, " stations across the city, day and night.</p>\n",
  '<ul class="links"><li><a href="stations.html">Find a station</a></li><li><a href="fares.html">See the fares</a></li>',
  '<li><a href="news.html">Read the news</a></li></ul>')), file.path(out, "site", "index.html"))
web_sites <- stations_out |> group_by(station_id) |> slice_tail(n = 1) |> ungroup()
cards <- vapply(seq_len(nrow(web_sites)), function(i) {
  s <- web_sites[i, ]
  note <- if (s$station_id == 179L) '\n  <p class="note">Opens in March 2026</p>' else if (s$station_id == 180L) '\n  <p class="note">Closed for works</p>' else if (s$station_id == 117L) '\n  <p class="note">Temporary location during quay repairs</p>' else ""
  sprintf('<article class="station" id="station-%d">\n  <h2 class="name">%s</h2>\n  <p class="area">%s</p>\n  <p class="docks"><span class="count">%d</span> docks</p>%s\n  <a class="details" href="station.html?id=%d">Details</a>\n</article>',
    s$station_id, html_escape(trimws(s$name)), s$neighbourhood, s$docks, note, s$station_id)
}, character(1))
writeLines(page("Stations", paste0("<h1>Stations</h1>\n", paste(cards, collapse = "\n"))), file.path(out, "site", "stations.html"))
current <- fares |> filter(is.na(valid_to))
fare_rows <- sprintf("<tr><td>%s</td><td>%s</td><td>$%.2f</td><td>$%.2f</td></tr>",
  if_else(current$member_type == "member", "Member", "Casual rider"), if_else(current$bike_type == "electric", "E-bike", "Classic bike"),
  current$unlock_fee, current$per_minute)
writeLines(page("Fares", paste0(
  "<h1>Fares</h1>\n<p>From 1 April 2025. Members pay an annual fee of $90.</p>\n",
  '<table class="fares">\n<thead><tr><th>Rider</th><th>Bike</th><th>Unlock</th><th>Per minute</th></tr></thead>\n<tbody>\n',
  paste(fare_rows, collapse = "\n"), "\n</tbody>\n</table>")), file.path(out, "site", "fares.html"))
news <- tribble(
  ~date, ~title, ~text,
  "2025-11-03", "Winter riding", "Stations stay open all winter. Staff clear the docks after snow, usually by 7 am.",
  "2025-10-06", "Tell us what you think", "Our rider survey is open until 26 October. It takes five minutes.",
  "2025-05-01", "Quay Street moves for the summer", "While the quay is repaired, Quay Street station is at a temporary site 150 metres east.",
  "2025-04-01", "New fares from today", "Unlocking a bike now costs $1.50 for casual riders. Classic bikes stay free for members.",
  "2024-10-15", "Saltings Lane closes for works", "Saltings Lane station is closed while the road is rebuilt."
)
articles <- sprintf('<article class="news">\n  <h2>%s</h2>\n  <time datetime="%s">%s</time>\n  <p>%s</p>\n</article>',
  news$title, news$date, format(as.Date(news$date), "%d %B %Y"), news$text)
writeLines(page("News", paste0("<h1>News</h1>\n", paste(articles, collapse = "\n"))), file.path(out, "site", "news.html"))
writeLines(c("body { font-family: sans-serif; max-width: 48rem; margin: 2rem auto; }", ".station { border: 1px solid #ccc; padding: .5rem 1rem; margin: .5rem 0; }",
  ".note { color: #a40; }", "table.fares td, table.fares th { padding: .25rem .75rem; text-align: left; }"), file.path(out, "site", "style.css"))

cat(sprintf("Larkhaven Bikes: %d trips since April 2021, %d of them in 2025, at %d stations\n", nrow(trips_out), nrow(trips_2025), n_sites))
