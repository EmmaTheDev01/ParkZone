import { FlatList, Image, Text, View, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import "../../global.css";
import { SlidingEffectIcons, dots, dotseffect } from "../../constants/sliding_effect";
import { useRouter } from 'expo-router';

const circleDiameter = 250;

export default function WelcomePage() {
  const { currentIcon } = SlidingEffectIcons();
  const { currentDot } = dotseffect();
  const router = useRouter();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#ffffff" }}>

       <View className="header-container">
      <Text className="Welcome-text"> Welcome to ParkZone</Text>
       </View>

      <View className="circle-container" style={{ alignSelf: "center", justifyContent: "center", alignItems: "center" }}>

        <View style={{flex:1, justifyContent: "center", alignItems: "center"}}>

        <FlatList className="sliding-list" 
          data={currentIcon ? [currentIcon] : []}
          horizontal
          snapToInterval={circleDiameter}
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <View style={{ width: circleDiameter, alignItems: "center" }}>
              <Image source={item.icon} style={{ width: circleDiameter, height: 100 }} resizeMode="contain" />
            </View>          
          )}
        />
        </View>
          </View>

          <View className="dots-row">

             <FlatList
               data={dots}
               horizontal
               contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
               showsHorizontalScrollIndicator={false}
               keyExtractor={(item) => item.id.toString()}
               renderItem={({ item }) => (
                 <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: currentDot.id === item.id ? "#1f2937" : "#cacaca", margin: 5 }} />
               )}
             />
          
          </View>

          <View className="text-container">
            <Text className="slide-title">{currentIcon.title}</Text>
            <Text className="slide-subtitle">{currentIcon.subtitle}</Text>
          </View>


     
        <View className="welcome-page">
        <TouchableOpacity
          className="Get-started-button"
          onPress={() => router.push("/(auth)/sign_in")}
          activeOpacity={0.8}
        >
          <Text className="Get-started-text">Get Started</Text>
        </TouchableOpacity>
        </View>


    </SafeAreaView>

    
  );
}