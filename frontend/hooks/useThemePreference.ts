import { useState, useEffect, useCallback } from "react";
import { Appearance } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type ThemePreference = "system" | "light" | "dark";

const THEME_PREFERENCE_KEY = "theme_preference";

function apply(pref: ThemePreference) {
    // null clears the override so the app follows the system theme
    Appearance.setColorScheme(pref === "system" ? null : pref);
}

/** Call once at app boot to restore the saved preference */
export async function applyStoredThemePreference() {
    try {
        const stored = await AsyncStorage.getItem(THEME_PREFERENCE_KEY);
        if (stored === "light" || stored === "dark") apply(stored);
    } catch {
        // fall back to system theme
    }
}

export function useThemePreference() {
    const [preference, setPreferenceState] = useState<ThemePreference>("system");

    useEffect(() => {
        AsyncStorage.getItem(THEME_PREFERENCE_KEY).then((stored) => {
            if (stored === "light" || stored === "dark") setPreferenceState(stored);
        });
    }, []);

    const setPreference = useCallback((pref: ThemePreference) => {
        setPreferenceState(pref);
        apply(pref);
        AsyncStorage.setItem(THEME_PREFERENCE_KEY, pref).catch(() => {});
    }, []);

    return { preference, setPreference };
}
