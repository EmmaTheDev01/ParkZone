import { supabase } from "../lib/supabase";

async function signUpWithPassword(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email,
    password: password,
  })

  if (error) throw error
  return data 
}

async function verifySignupOtp(email, token) {
  const { data: { session }, error } = await supabase.auth.verifyOtp({
    email: email,
    token: token,
    type: 'signup',
  })

  if (error) throw error
  return session
}


async function recoveryPassword(email) {
  try {
    const { data, error } = await supabase.functions.invoke("send-otp-email", {
      body: { email: email.trim().toLowerCase(), type: "recovery" },
    });
    if (!error && data?.success) {
      return data;
    }
  } catch (err) {
    console.warn("Edge function fallback to auth.resetPasswordForEmail:", err);
  }

  const { data, error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());
  if (error) throw error;
  return data;
}


async function verfiyRecoveryOtp(email, token){
  const { data, error } = await supabase.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: token.trim(),
    type: 'recovery',
  });

  if (error) throw error;
  return data;
}

async function resendotp(email, flowType) {
  const { data, error } = await supabase.auth.resend({
    email: email,
    type: flowType, // 'signup' | 'email_change' | 'sms' | 'phone_change'
  })

  if (error) throw error
  return data
}


const sendPasswordResetOtp = recoveryPassword;
const verifyRecoveryOtp = verfiyRecoveryOtp;

export {
  signUpWithPassword,
  verifySignupOtp,
  resendotp,
  recoveryPassword,
  verfiyRecoveryOtp,
  sendPasswordResetOtp,
  verifyRecoveryOtp,
};