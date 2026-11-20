# A script written in a hurry
fast<-trips|>filter(duration_min<10,bike_type=="electric")|>select(trip_id,start_station,duration_min)
km_to_miles<-function(km){km*0.621371}
