import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { reloadAppAsync } from "expo";
import { router } from "expo-router";
import type { QueryClient } from "@tanstack/react-query";
import { logger } from "@/utils/logger";

// Developer tool: puts the device back into the state of a fresh install so the
// guest / onboarding flow can be tested repeatedly without deleting the app.
// Only local state is touched; the server-side account (guest or real) is left
// alone.

// Exact AsyncStorage keys that mark "this device has been here before".
const EXACT_KEYS = [
    "auth_user_cache",
    "hasEverSignedIn",
    "guestDeviceId",
    "guestInstall",
    "hasSeenIntroVideo",
];

// Per-user flags are stored as `${userId}<suffix>`.
const KEY_SUFFIXES = [
    "-home-tour-seen",
    "-intro-tour-seen",
    "-guest-tutorial-done",
    "-account-prompt-first-task",
    "-onboarding-checklist-dismissed",
    "-onboarding-checklist-snapshot",
    "-onboarding-checklist-complete",
];

// Caches and one-time hints stored as `<prefix><id>`.
const KEY_PREFIXES = [
    "workspaces_cache_",
    "recent_workspaces_",
    "hint_", // first-touch hints (hooks/useFirstTouchHint)
];

const shouldRemove = (key: string) =>
    EXACT_KEYS.includes(key) ||
    KEY_SUFFIXES.some((s) => key.endsWith(s)) ||
    KEY_PREFIXES.some((p) => key.startsWith(p));

type Options = {
    queryClient?: QueryClient;
    // Used only if a native reload isn't possible: clears in-memory auth so the
    // router.replace("/") fallback doesn't bounce straight back into the app.
    logout?: () => void;
};

// Wipes the local state only, without reloading. Used by the reset tool and by
// the dev-only EXPO_PUBLIC_FORCE_FIRST_LAUNCH flag at app entry.
export async function clearFirstLaunchState() {
    try {
        await SecureStore.deleteItemAsync("auth_data");
    } catch (e) {
        logger.warn("resetFirstLaunch: failed to delete auth_data", e);
    }

    try {
        const keys = await AsyncStorage.getAllKeys();
        const toRemove = keys.filter(shouldRemove);
        if (toRemove.length) await AsyncStorage.multiRemove(toRemove);
    } catch (e) {
        logger.warn("resetFirstLaunch: failed to clear AsyncStorage keys", e);
    }
}

export async function resetFirstLaunch({ queryClient, logout }: Options = {}) {
    await clearFirstLaunchState();
    queryClient?.clear();

    // A full JS reload drops every in-memory context (auth, tasks, tours) so the
    // app boots exactly like a first launch. Works in release builds too.
    try {
        await reloadAppAsync("Reset to first launch");
        return;
    } catch (e) {
        logger.warn("resetFirstLaunch: reloadAppAsync failed, falling back to router", e);
    }
    logout?.();
    router.replace("/");
}

// Dev only: EXPO_PUBLIC_FORCE_FIRST_LAUNCH=true makes every JS load (cold start
// or `r` reload) begin as a brand-new install. Module state resets on reload, so
// this runs once per load rather than on every visit to "/".
let forcedThisLoad = false;
export async function maybeForceFirstLaunch() {
    if (!__DEV__ || forcedThisLoad || process.env.EXPO_PUBLIC_FORCE_FIRST_LAUNCH !== "true") return;
    forcedThisLoad = true;
    await clearFirstLaunchState();
}
