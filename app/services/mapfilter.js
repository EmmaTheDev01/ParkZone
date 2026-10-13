import { supabase } from "../lib/supabase";


async function getNearbyLocations (latitude, longitude){

    const MAX_DISTANCE = 2 // Radius to filter locations within 2km

            try {

                const {data, error} = await supabase
                    .from("parking_locations")
                    .select("*")
                    .eq("is_active", true);

                if(error){
                    throw new Error("Encountered an error please try again later");
                }

                const nearby = (await Promise.all(
                    data.map(async location => ({
                        ...location,
                        distance: await calculateDistance(latitude, longitude, location.latitude, location.longitude)
                    }))
                ))
                .filter(location => location.distance <= MAX_DISTANCE)
                .sort((a, b) => a.distance - b.distance);

                return nearby;
            }
            catch (error) {
                return "Error encountered: " + error.message;
            }
        

}


async function getHandicapLocations (latitude, longitude){

    const MAX_DISTANCE = 10 // Radius to filter locations around 10 kilometers

    try{

        const {data, error} = await supabase
            .from("parking_locations")
            .select( `
                id,
                latitude,
                longitude,
                is_active,
                parking_spaces!inner(id, space_type)
                `)
            .eq("is_active", true)
            .eq("parking_spaces.space_type", "handicap");

        if(error){
            throw new Error("Encountered an error please try again later");
        }

        const nearby = (await Promise.all(
            data.map(async location => ({
                ...location,
                distance: await calculateDistance(latitude, longitude, location.latitude, location.longitude)
            }))
        ))
        .filter(location => location.distance <= MAX_DISTANCE)
        .sort((a, b) => a.distance - b.distance);


        return nearby;
    }
    catch (error) {
        return "Error encountered: " + error.message;
    }

}




async function getChargingStationLocations (latitude, longitude){


    const MAX_DISTANCE = 10 // Radius to filter locations around 10 kilometers

    try{

        const {data, error} = await supabase
            .from("parking_locations")
            .select( `
                id,
                latitude,
                longitude,
                is_active,
                parking_spaces!inner(id, space_type)
                `)
            .eq("is_active", true)
            .eq("parking_spaces.space_type", "ev");

        if(error){
            throw new Error("Encountered an error please try again later");
        }

        const nearby = (await Promise.all(
            data.map(async location => ({
                ...location,
                distance: await calculateDistance(latitude, longitude, location.latitude, location.longitude)
            }))
        ))
        .filter(location => location.distance <= MAX_DISTANCE)
        .sort((a, b) => a.distance - b.distance);

        return nearby;
    }
    catch (error) {
        return "Error encountered: " + error.message;
    }

}




async function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        0.5 - Math.cos(dLat)/2 + 
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        (1 - Math.cos(dLon))/2;
    return R * 2 * Math.asin(Math.sqrt(a));
}

export default function () {
    return null;
}







export { getNearbyLocations, getHandicapLocations, getChargingStationLocations };
