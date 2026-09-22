import { SafeAreaView } from "react-native-safe-area-context";
import { Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import ConfettiCannon from "react-native-confetti-cannon";


const Successfully = () => {
  const router = useRouter();
  return (
  <SafeAreaView className="success-screen">



    <View className="success-content">
      <View className="success-mark">
        <Text className="success-mark-text">✓</Text>
      </View>
      <Text className="success-eyebrow">PARKZONE</Text>
      <Text className="success-text"> Password has been changed. Back to login</Text>
      <Text className="success-subtext">Your password has been changed successfully. Back to login</Text>
     
     </View>


        <View className="back-button-container">
          <TouchableOpacity
            className="back-login-button"
            onPress={() => router.push("/(auth)/sign_in")}
          >
            <Text className="back-login-button-text">Back to Login</Text>
            </TouchableOpacity>
        </View>


  </SafeAreaView>
  );
};

export default Successfully;