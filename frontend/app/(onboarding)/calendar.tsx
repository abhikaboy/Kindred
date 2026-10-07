import { Dimensions, StyleSheet, View, Animated, TouchableOpacity } from "react-native";
import React, { useEffect, useRef, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useRouter } from "expo-router";
import { useThemeColor } from "@/hooks/useThemeColor";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import { OnboardingBackground } from "@/components/onboarding/BackgroundGraphics";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { CalendarBlank, GoogleLogo } from "phosphor-react-native";
import * as WebBrowser from "expo-web-browser";
import { connectGoogleCalendar, getCalendarConnections } from "@/api/calendar";
import CalendarSetupBottomSheet from "@/components/modals/CalendarSetupBottomSheet";
import { showToast } from "@/utils/showToast";
import { useAnalytics } from "@/hooks/useAnalytics";
import { AnalyticsEvents } from "@/utils/analytics";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

const CalendarOnboarding = () => {
    const ThemedColor = useThemeColor();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { capture } = useAnalytics();

    const [loading, setLoading] = useState(false);
    const [pendingConnectionId, setPendingConnectionId] = useState<string | null>(null);
    const [showSetup, setShowSetup] = useState(false);

    // Animations
    const iconFade = useRef(new Animated.Value(0)).current;
    const iconScale = useRef(new Animated.Value(0.5)).current;
    const headingFade = useRef(new Animated.Value(0)).current;
    const headingSlide = useRef(new Animated.Value(20)).current;
    const statFade = useRef(new Animated.Value(0)).current;
    const buttonsFade = useRef(new Animated.Value(0)).current;
    const buttonsSlide = useRef(new Animated.Value(20)).current;

    useEffect(() => {
        // Icon pops in
        Animated.parallel([
            Animated.timing(iconFade, { toValue: 1, duration: 400, delay: 200, useNativeDriver: true }),
            Animated.spring(iconScale, { toValue: 1, friction: 5, tension: 100, delay: 200, useNativeDriver: true }),
        ]).start();

        // Heading fades + slides
        Animated.parallel([
            Animated.timing(headingFade, { toValue: 1, duration: 500, delay: 500, useNativeDriver: true }),
            Animated.timing(headingSlide, { toValue: 0, duration: 500, delay: 500, useNativeDriver: true }),
        ]).start();

        // Stat fades in
        Animated.timing(statFade, { toValue: 1, duration: 400, delay: 800, useNativeDriver: true }).start();

        // Buttons
        Animated.parallel([
            Animated.timing(buttonsFade, { toValue: 1, duration: 500, delay: 1000, useNativeDriver: true }),
            Animated.timing(buttonsSlide, { toValue: 0, duration: 500, delay: 1000, useNativeDriver: true }),
        ]).start();
    }, []);

    const handleConnect = async () => {
        setLoading(true);
        try {
            const { auth_url } = await connectGoogleCalendar();
            const result = await WebBrowser.openAuthSessionAsync(auth_url, "kindred://");

            if (result.type === "success" && result.url) {
                const connIdMatch = result.url.match(/connectionId=([^&]+)/);
                const connId = connIdMatch?.[1];
                if (connId) {
                    setPendingConnectionId(connId);
                    setShowSetup(true);
                    return;
                }
            }

            // Fallback: check connections
            const { connections } = await getCalendarConnections();
            if (connections && connections.length > 0) {
                const pending = connections.find((c) => !c.setup_complete);
                if (pending) {
                    setPendingConnectionId(pending.id);
                    setShowSetup(true);
                    return;
                }
                const completed = connections.find((c) => c.setup_complete);
                if (completed) {
                    showToast("Calendar connected!", "success");
                    capture(AnalyticsEvents.ONBOARDING_COMPLETED, {});
                    router.replace("/(logged-in)/(tabs)/(task)");
                    return;
                }
            }
        } catch (error) {
            console.error("Calendar connect failed:", error);
            showToast("Couldn't connect calendar. You can try again later.", "danger");
        } finally {
            setLoading(false);
        }
    };

    const handleSetupComplete = () => {
        setShowSetup(false);
        setPendingConnectionId(null);
        showToast("Calendar connected!", "success");
        capture(AnalyticsEvents.ONBOARDING_COMPLETED, {});
        router.replace("/(logged-in)/(tabs)/(task)");
    };

    const handleSkip = () => {
        capture(AnalyticsEvents.ONBOARDING_COMPLETED, {});
        router.replace("/(logged-in)/(tabs)/(task)");
    };

    return (
        <ThemedView style={styles.mainContainer}>
            <View style={styles.backgroundContainer}>
                <OnboardingBackground />
            </View>

            <View style={styles.contentContainer}>
                {/* Calendar icon */}
                <Animated.View style={[styles.iconContainer, {
                    opacity: iconFade,
                    transform: [{ scale: iconScale }],
                }]}>
                    <View style={[styles.iconCircle, { backgroundColor: ThemedColor.primary + "15" }]}>
                        <CalendarBlank size={48} color={ThemedColor.primary} weight="duotone" />
                    </View>
                </Animated.View>

                {/* Heading */}
                <Animated.View style={[styles.headingContainer, {
                    opacity: headingFade,
                    transform: [{ translateY: headingSlide }],
                }]}>
                    <ThemedText style={styles.titleText}>
                        Connect your calendar
                    </ThemedText>
                    <ThemedText style={[styles.subtitleText, { color: ThemedColor.text }]}>
                        See your schedule alongside your tasks so nothing falls through the cracks
                    </ThemedText>
                </Animated.View>

                {/* Stat */}
                <Animated.View style={[styles.statContainer, {
                    opacity: statFade,
                    backgroundColor: ThemedColor.primary + "10",
                    borderColor: ThemedColor.primary + "20",
                }]}>
                    <CalendarBlank size={24} color={ThemedColor.primary} weight="fill" />
                    <ThemedText style={[styles.statText, { color: ThemedColor.text }]}>
                        Kindred users who connect their calendar complete their tasks 3x as often
                    </ThemedText>
                </Animated.View>
            </View>

            {/* Buttons */}
            <Animated.View style={[styles.buttonsContainer, {
                opacity: buttonsFade,
                transform: [{ translateY: buttonsSlide }],
                paddingBottom: 40 + insets.bottom,
            }]}>
                <PrimaryButton
                    title={loading ? "Connecting..." : "Connect Google Calendar"}
                    onPress={handleConnect}
                    disabled={loading}
                />
                <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
                    <ThemedText style={[styles.skipText, { color: ThemedColor.caption }]}>
                        Skip for now
                    </ThemedText>
                </TouchableOpacity>
            </Animated.View>

            {pendingConnectionId && (
                <CalendarSetupBottomSheet
                    visible={showSetup}
                    setVisible={setShowSetup}
                    connectionId={pendingConnectionId}
                    onComplete={handleSetupComplete}
                    onCancel={() => {
                        setShowSetup(false);
                        setPendingConnectionId(null);
                    }}
                />
            )}
        </ThemedView>
    );
};

const styles = StyleSheet.create({
    mainContainer: {
        flex: 1,
        position: "relative",
    },
    backgroundContainer: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 0,
    },
    contentContainer: {
        flex: 1,
        paddingHorizontal: HORIZONTAL_PADDING,
        paddingTop: screenHeight * 0.18,
        zIndex: 1,
    },
    iconContainer: {
        alignItems: "flex-start",
        marginBottom: 24,
    },
    iconCircle: {
        width: 96,
        height: 96,
        borderRadius: 48,
        justifyContent: "center",
        alignItems: "center",
    },
    headingContainer: {
        alignItems: "flex-start",
        gap: 12,
        marginBottom: 32,
    },
    titleText: {
        fontSize: Math.min(screenWidth * 0.085, 32),
        fontFamily: "Fraunces",
        fontWeight: "600",
        lineHeight: Math.min(screenWidth * 0.102, 38),
        letterSpacing: -1,
        textAlign: "left",
    },
    subtitleText: {
        fontSize: 16,
        fontFamily: "Outfit",
        fontWeight: "400",
        opacity: 0.6,
        textAlign: "left",
        lineHeight: 22,
    },
    statContainer: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
    },
    statNumber: {
        fontSize: 28,
        fontFamily: "Outfit",
        fontWeight: "700",
    },
    statText: {
        fontSize: 14,
        fontFamily: "Outfit",
        fontWeight: "400",
        opacity: 0.7,
        flex: 1,
        lineHeight: 20,
    },
    buttonsContainer: {
        paddingHorizontal: HORIZONTAL_PADDING,
        paddingBottom: 40,
        gap: 16,
        zIndex: 1,
    },
    skipButton: {
        alignItems: "center",
        paddingVertical: 8,
    },
    skipText: {
        fontSize: 16,
        fontFamily: "Outfit",
        fontWeight: "500",
    },
});

export default CalendarOnboarding;
