import { TouchableOpacity, View , Image,Text, TextInput, Platform, Alert} from "react-native";
import { useEffect, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { MapViewProps } from "react-native-maps";
import { useRef } from "react";
import BottomSheet from "@gorhom/bottom-sheet";
import { Icons } from "../../constants/icons"
import { getNearbyLocations } from "../services/mapfilter";
import * as Location from "expo-location";




const Home = () => {
  const [isPressed, setIsPressed] = useState(false);

    const [marker, setMarker] = useState<{ latitude: number; longitude: number } | null>(null);

    const mapRef = useRef<MapView>(null);


  const enableLocations = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      if (Platform.OS === "android") {
        try {
          await Location.enableNetworkProviderAsync();
        } catch {
        }
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const coords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      setMarker(coords);

      
      mapRef.current?.animateToRegion(
        {
          latitude: coords.latitude,
          longitude: coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        600
      );
    } catch (error) {
      console.warn("Could not get location", error);
    }
  };

  return (
    <SafeAreaView className="home-screen">
      <View className="map-section">
        <View className="map-content">
          <MapView
            ref={mapRef}
            showsUserLocation={true}
            style={{ flex: 1 }}
            initialRegion={{
              latitude: 37.78825,
              longitude: -122.4324,
              latitudeDelta: 0.0922,
              longitudeDelta: 0.0421,
            }}
          />
          <View
            className="map-indicator"
            pointerEvents="none"
           
            
            style={{
              top: "50%",
              left: "50%",
              transform: [{ translateX: -20 }, { translateY: -52 }],
            }}
          >
            <View className="map-indicator-head">
              <Image className="map-indicator-icon" style={{ tintColor: "#FFFFFF" }} source={Icons.mapIndicatorIcon} />
            </View>
            <View className="map-indicator-tip" />
          </View>
        </View>

        <View className="map-controls">
          <View className="map-control-stack">
            <TouchableOpacity>
              <View className="inner-square">
                <Image className="search-icon" source={require("../assets/icons/search.png")} />
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setIsPressed(!isPressed)}>
              <View className="inner-square-charging-station">
                <Image
                  className="charging-station-icon"
                  source={isPressed ? require("../assets/icons/charger-station-active.png") : require("../assets/icons/charging-station.png")}
                  style={isPressed ? { transform: [{ scale: 1.17 }] } : undefined}
                />
              </View>
            </TouchableOpacity>
          </View>
          <View className="map-control-stack">
            <TouchableOpacity

            onPress={() => {
              setIsPressed(isPressed);

              Alert.alert("Handicap Mode is active");
            }}

            
            >
              <View className="inner-square-settings">
                <Image className="settings-icon" source={require("../assets/icons/menu.png")} />
              </View>
            </TouchableOpacity>
            <TouchableOpacity>
              <View className="inner-square-handicap">
                <Image className="handicap-icon" source={require("../assets/icons/disabled_parking.png")} />
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <BottomSheet
        index={0}
        snapPoints={["25%", "85%"]}
        enableDynamicSizing={false}
        containerStyle={{ zIndex: 20, elevation: 20 }}
        backgroundStyle={{ backgroundColor: "#ffffff" }}
        handleIndicatorStyle={{ backgroundColor: "#6b7280" }}
      >
        <View className="bottom-sheet-content">
          <View className="search-bar-container">
            <View className="search-bar-field">
              <Image className="search-bar-icon" source={Icons.searchBarIcon} />
              <TextInput
                className="search-bar"
                placeholder="Enter parking location or Zone"
                style={{ marginLeft: 10 }}
              />
            </View>
          </View>
        </View>

               
               <View className="nearby-locations-container">

                <View className="nearby-title-row">
                  <Image className="parking-icon" source={Icons.regularParkingIcon} />
                  <Text className="text-nearby-locations">
                        Nearby Parkings 
                  </Text>
                </View>
                <View className="nearby-divider" />

            
                <TouchableOpacity onPress={enableLocations}>
                  <View className="search-button">
                    <Text className="text-search-button">
                      Search Nearby Parkings
                    </Text>
                  </View>
                </TouchableOpacity>

               </View>


      </BottomSheet>
    </SafeAreaView>
  );
}


export default Home;