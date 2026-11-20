# Larkhaven Bikes data

Larkhaven is a lakeside city with a bike-share scheme, Larkhaven Bikes. The scheme opened in April 2021 with 45 stations and now has 80. Riders are either members, who pay a yearly fee, or casual riders, who pay per trip. Every file here describes the same city, so a station ID in one file means the same station in all of them.

The city and its data are made up. They were generated for these lessons.

Times are local clock times in Larkhaven, which changes its clocks for daylight saving: forward on 9 March 2025 and back on 2 November 2025. The files record no time zone.

| File | What it holds |
| --- | --- |
| `trips.csv` | Every trip in 2025: one row per trip, with its bike, start and end times and stations, rider type, bike type, distance in km and duration in minutes. |
| `archive/` | Every trip since the scheme opened (2021 to 2025), as Parquet files in one folder per year and month. |
| `stations.csv` | The station registry: ID, name, neighbourhood, latitude and longitude, number of docks, opening date, and a former name for stations that were renamed. |
| `bikes.csv` | Each bike: its ID, type (classic or electric), model and the date it entered service. |
| `fares.csv` | What a trip costs: an unlock fee and a price per minute, by rider and bike type, for each period the fares applied. |
| `weather.csv` | The city's weather sensor in 2025, hourly: temperature in °C, rain in mm and wind speed in km/h. |
| `survey.csv` | 1,500 answers to the October 2025 rider survey. |
| `exports/` | Twelve monthly station reports, as the operator's dashboard exports them. |
| `station-months.csv`, `station-periods.csv`, `station-riders.csv` | Trip counts per station in 2025, laid out as summary tables for reading by people. |
| `maintenance.xlsx` | The depots' repair logs for 2025: a summary sheet and one sheet per depot. |
| `feed/` | A snapshot of the live station feed, in the JSON format bike-share schemes publish. |
| `site/` | Pages from the scheme's website. |

Like most real data, these files have problems. Finding and fixing them is part of the lessons.
