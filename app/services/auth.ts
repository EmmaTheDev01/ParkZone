import { Alert } from "react-native";
import { supabase } from "../lib/supabase";

 

export const signIn = async (phoneNumber: string, password: string) => {
    const normalizedPhoneNumber = phoneNumber.trim();

    if (!normalizedPhoneNumber || !password) {
        throw new Error("Phone number and password are required");
    }

    return supabase.auth.signInWithPassword({
        phone: normalizedPhoneNumber,
        password,
    });
};


export const signUp = async (email: string, password: string , phoneNumber?: string) => {
    if (!email.trim() || !password) {
        throw new Error("Email and password are required");
    }

    const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
            data: {
                phone_number: phoneNumber?.trim() || null,
            },

           
        },
    })
    if (error) {
        if (error.message.toLowerCase().includes("confirmation email")) {
            throw new Error(
                "We could not send the confirmation email"
            );
        }

        throw new Error(error.message);
    }

    if (!data.user) {
        throw new Error("Account creation did not return a user.");
    }


    return data;

};


export const checkUserExists = async (phoneNumber: string)=>{

    const { data, error } = await supabase
        .from("profiles")
        .select("id")
        .eq("phone_number", phoneNumber.trim())
        .limit(1);

    if (error) {
        throw new Error("Error checking user. Please try again later.");
    }

    if (data.length > 0) {
        throw new Error("User with this phone number already exists. Please use a different phone number.");
    }

    return false;
};

/**
 * Sends a password reset OTP email using the 'send-otp-email' Edge Function,
 * with graceful fallback to Supabase's built-in resetPasswordForEmail.
 */
export const sendPasswordResetOtp = async (email: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
        throw new Error("Email is required");
    }

    try {
        // 1. Try invoking the Supabase Edge Function
        const { data, error } = await supabase.functions.invoke("send-otp-email", {
            body: { email: normalizedEmail, type: "recovery" },
        });

        if (!error && data?.success) {
            return { success: true, message: data.message || "Verification code sent to your email." };
        }

        // If the function returned an error with a specific message
        if (error && error.message && !error.message.includes("Failed to send") && !error.message.includes("FunctionsFetchError")) {
            console.warn("Edge function returned error, trying fallback:", error.message);
        }
    } catch (invokeError) {
        console.warn("Edge function invocation failed, falling back to Supabase Auth:", invokeError);
    }

    // 2. Fallback to Supabase built-in auth resetPasswordForEmail
    const { error: fallbackError } = await supabase.auth.resetPasswordForEmail(normalizedEmail);
    if (fallbackError) {
        throw new Error(fallbackError.message || "Failed to send verification code. Please try again later.");
    }

    return {
        success: true,
        message: "Verification code sent to your email.",
    };
};

/**
 * Verifies the 6-digit recovery OTP for the given email
 */
export const verifyRecoveryOtp = async (email: string, token: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedToken = token.trim();

    if (!normalizedEmail || !normalizedToken) {
        throw new Error("Email and OTP code are required.");
    }

    const { data, error } = await supabase.auth.verifyOtp({
        email: normalizedEmail,
        token: normalizedToken,
        type: "recovery",
    });

    if (error) {
        throw new Error(error.message || "Invalid or expired verification code.");
    }

    return data;
};

/**
 * Updates the user's password once verified
 */
export const updatePassword = async (newPassword: string) => {
    if (!newPassword || newPassword.length < 8) {
        throw new Error("Password must be at least 8 characters long.");
    }

    const { data, error } = await supabase.auth.updateUser({
        password: newPassword,
    });

    if (error) {
        throw new Error(error.message || "Failed to update password.");
    }

    return data;
};