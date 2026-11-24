import { AppState, AppStateStatus, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { reportNetworkFailure, reportNetworkSuccess } from "../services/networkMonitor";

let supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL || "").trim();
const supabaseAnonKey = (
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
    ""
).trim();

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("Missing database environment variables. Check your .env file.");
}

if (supabaseUrl && !supabaseUrl.startsWith("http://") && !supabaseUrl.startsWith("https://")) {
    supabaseUrl = `https://${supabaseUrl}`;
}

const monitoredFetch: typeof fetch = async (input, init) => {
    const controller = new AbortController();
    let timedOut = false;
    const timeoutId = setTimeout(() => {
        timedOut = true;
        controller.abort();
    }, 12000);

    const onExternalAbort = () => controller.abort();
    if (init?.signal) {
        if (init.signal.aborted) {
            controller.abort();
        } else {
            init.signal.addEventListener("abort", onExternalAbort);
        }
    }

    try {
        const response = await fetch(input, {
            ...init,
            signal: controller.signal,
        });
        reportNetworkSuccess();
        return response;
    } catch (err) {
        // Only report a network failure if it was a timeout or genuine network error,
        // not a caller-initiated cancellation.
        if (timedOut || !init?.signal?.aborted) {
            reportNetworkFailure(err);
        }
        throw err;
    } finally {
        clearTimeout(timeoutId);
        init?.signal?.removeEventListener("abort", onExternalAbort);
    }
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: Platform.OS === "web",
    },
    global: {
        fetch: monitoredFetch,
    },
});

// Expo SDK v54 recommended AppState listener to keep Supabase JWTs fresh in foreground
if (Platform.OS !== "web") {
    AppState.addEventListener("change", (state: AppStateStatus) => {
        if (state === "active") {
            supabase.auth.startAutoRefresh();
        } else {
            supabase.auth.stopAutoRefresh();
        }
    });
}

export default function () {
    return null;
}
