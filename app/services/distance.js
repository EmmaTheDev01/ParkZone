import { supabase } from "../lib/supabase";


async function getShortestDistance (latitude, longitude){


            try {

                const {data, error} = await supabase
                    .from("parking_locations")
                    .select("*")
                    .eq("is_active", true);

                    const getShortest = data
                    .map(location => ({
                        ...location,
                        distance: calculateDistance(latitude, longitude, location.latitude, location.longitude)
                    }))
                    .sort((a, b) => a.distance - b.distance);


                    if( error){
                        return "Error encountered"
                    }


                    else {
                        return getShortest[0];
                    }
                

            } 
            catch (error) {
                return "Error encountered: " + error.message;
            }

}

export { getShortestDistance };


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