import { useEffect, useState } from "react";
import { SafeAreaView, Text, TouchableOpacity, View } from "react-native";
import { supabase } from "./lib/supabase";
const DbConnection = () => {
        const [status, setStatus] = useState("Checking database connection...");
        const [isConnected, setIsConnected] = useState(false);

        const checkConnection = async () => {
                setStatus("Checking database connection...");
                setIsConnected(false);

                try {
                        const { error } = await supabase.auth.getSession();

                        if (error) {
                                setStatus(error.message);
                                return;
                        }

                        setIsConnected(true);
                        setStatus("Database connected successfully");
                } catch (error) {
                        setStatus(error instanceof Error ? error.message : "Connection failed");
                }
        };

        useEffect(() => {
                checkConnection();
        }, []);

        return (
                <SafeAreaView className="auth-screen">
                        <View className="auth-content items-center">
                                <Text className={isConnected ? "text-green-600" : "error-text"}>
                                        {status}
                                </Text>

                                <TouchableOpacity
                                        className="sign-up-button mt-6"
                                        onPress={checkConnection}
                                >
                                        <Text className="create-account-text">Check Again</Text>
                                </TouchableOpacity>
                        </View>
                </SafeAreaView>
        );
};

export default DbConnection;
