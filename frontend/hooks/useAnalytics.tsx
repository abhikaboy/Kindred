import React, { createContext, useContext, useEffect, useRef, useCallback } from "react";
import { AppState, type AppStateStatus, Platform } from "react-native";
import { usePathname, useSegments } from "expo-router";
import PostHog from "posthog-react-native";
import { AnalyticsEvents, TabNames } from "@/utils/analytics";
import type { AnalyticsEvent } from "@/utils/analytics";
import { createLogger } from "@/utils/logger";

const logger = createLogger("Analytics");

// ---------------------------------------------------------------------------
// Singleton PostHog client
// ---------------------------------------------------------------------------

let posthogClient: PostHog | null = null;

function getPostHogClient(): PostHog | null {
    if (posthogClient) return posthogClient;

    const apiKey = process.env.EXPO_PUBLIC_POSTHOG_API_KEY;
    if (!apiKey) {
        logger.warn("EXPO_PUBLIC_POSTHOG_API_KEY not set — analytics disabled");
        return null;
    }

    posthogClient = new PostHog(apiKey, {
        host: "https://us.i.posthog.com",
        // Disable automatic screen capture — we do it manually for richer data
        captureNativeAppLifecycleEvents: false,
    });

    logger.debug("PostHog client initialized");
    return posthogClient;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface AnalyticsContextType {
    capture: (event: AnalyticsEvent | string, properties?: Record<string, any>) => void;
    identify: (userId: string, properties?: Record<string, any>) => void;
    reset: () => void;
    screen: (screenName: string, properties?: Record<string, any>) => void;
}

const AnalyticsContext = createContext<AnalyticsContextType>({
    capture: () => {},
    identify: () => {},
    reset: () => {},
    screen: () => {},
});

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
    const client = getPostHogClient();
    const pathname = usePathname();
    const segments = useSegments();
    const prevPathname = useRef<string | null>(null);
    const sessionStart = useRef<number>(Date.now());
    const lastScreenTime = useRef<number>(Date.now());
    const appState = useRef<AppStateStatus>(AppState.currentState);

    // --- Core methods -------------------------------------------------------

    const capture = useCallback(
        (event: AnalyticsEvent | string, properties?: Record<string, any>) => {
            if (!client) return;
            client.capture(event, properties);
        },
        [client],
    );

    const identify = useCallback(
        (userId: string, properties?: Record<string, any>) => {
            if (!client) return;
            client.identify(userId, properties);
            logger.debug("Identified user", userId);
        },
        [client],
    );

    const reset = useCallback(() => {
        if (!client) return;
        client.reset();
        logger.debug("Analytics reset (logout)");
    }, [client]);

    const screen = useCallback(
        (screenName: string, properties?: Record<string, any>) => {
            if (!client) return;
            client.screen(screenName, properties);
        },
        [client],
    );

    // --- Automatic screen tracking -----------------------------------------

    useEffect(() => {
        if (!client) return;
        if (!pathname || pathname === prevPathname.current) return;

        const now = Date.now();
        const durationOnPrevScreen = prevPathname.current
            ? now - lastScreenTime.current
            : undefined;

        capture(AnalyticsEvents.SCREEN_VIEWED, {
            screen_name: pathname,
            previous_screen: prevPathname.current,
            segments: segments,
            duration_on_previous_ms: durationOnPrevScreen,
        });

        screen(pathname, { segments });

        prevPathname.current = pathname;
        lastScreenTime.current = now;
    }, [pathname, segments, client, capture, screen]);

    // --- App lifecycle tracking ---------------------------------------------

    useEffect(() => {
        if (!client) return;

        const subscription = AppState.addEventListener(
            "change",
            (nextState: AppStateStatus) => {
                const prevState = appState.current;
                appState.current = nextState;

                if (nextState === "active" && prevState !== "active") {
                    sessionStart.current = Date.now();
                    capture(AnalyticsEvents.APP_OPENED, {
                        previous_state: prevState,
                    });
                }

                if (
                    nextState === "background" &&
                    prevState === "active"
                ) {
                    const sessionDuration = Date.now() - sessionStart.current;
                    capture(AnalyticsEvents.APP_BACKGROUNDED, {
                        session_duration_ms: sessionDuration,
                        last_screen: pathname,
                    });
                }
            },
        );

        return () => subscription.remove();
    }, [client, capture, pathname]);

    // --- Flush on unmount ---------------------------------------------------

    useEffect(() => {
        return () => {
            client?.flush();
        };
    }, [client]);

    return (
        <AnalyticsContext.Provider value={{ capture, identify, reset, screen }}>
            {children}
        </AnalyticsContext.Provider>
    );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAnalytics() {
    return useContext(AnalyticsContext);
}
