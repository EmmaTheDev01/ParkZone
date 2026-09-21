import React from "react";
import { useState } from "react";
import { TextInput, View, Button, StyleSheet, Image, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { TouchableOpacity } from "react-native"; 

 const NewPassword = () => {



    return(
    <SafeAreaView className="auth-screen">


        <View className="forgot-password-container">
        <TextInput placeholder="Enter New Password" secureTextEntry={true} className="forgot-password-input" />
        <TextInput placeholder="Confirm New Password" secureTextEntry={true} className="forgot-password-input" />
        </View>

         <View className="forgot-button-container">
            <TouchableOpacity className="forgot-button">
                <Text className="forgot-button-text">Confirm New Password</Text>
            </TouchableOpacity>
        </View>
    </SafeAreaView>

    )




 };


export default NewPassword;