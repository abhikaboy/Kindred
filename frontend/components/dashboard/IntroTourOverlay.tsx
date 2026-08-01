import React, { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, useColorScheme, View } from "react-native";
import { BlurView } from "expo-blur";
import { CaretLeft, CaretRight, House, Moon } from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedText } from "@/components/ThemedText";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import type { IntroStep } from "@/hooks/useIntroTour";

type Props = {
    active: boolean;
    step: IntroStep | null;
    stepIndex: number;
    totalSteps: number;
    onHomeButtonPress: () => void;
    onFocusModePress: () => void;
    onSkip: () => void;
};

const COPY: Record<IntroStep, string> = {
    swipeRight: "Swipe right for your workspaces",
    swipeLeft: "Swipe left for your calendar & list view",
    homeButton: "Tap here to jump back home anytime",
    focusMode: "See just today's tasks — nothing else",
};

export const IntroTourOverlay: React.FC<Props> = ({
    active,
    step,
    stepIndex,
    totalSteps,
    onHomeButtonPress,
    onFocusModePress,
    onSkip,
}) => {
    const tint = useColorScheme() === "dark" ? "dark" : "light";
    const insets = useSafeAreaInsets();
    const bounce = useRef(new Animated.Value(0)).current;

    const isSwipeStep = step === "swipeRight" || step === "swipeLeft";

    useEffect(() => {
        if (!isSwipeStep) return;
        bounce.setValue(0);
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(bounce, { toValue: 1, duration: 550, useNativeDriver: true }),
                Animated.timing(bounce, { toValue: 0, duration: 550, useNativeDriver: true }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [isSwipeStep, step, bounce]);

    if (!active || !step) return null;

    const translateX = bounce.interpolate({
        inputRange: [0, 1],
        outputRange: step === "swipeRight" ? [0, 14] : [0, -14],
    });

    return (
        <View style={[StyleSheet.absoluteFill, { zIndex: 1000 }]} pointerEvents="box-none">
            <BlurView
                intensity={isSwipeStep ? 8 : 20}
                tint={tint}
                pointerEvents={isSwipeStep ? "none" : "auto"}
                style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.35)", zIndex: 0, elevation: 0 }]}
            />

            <Pressable onPress={onSkip} hitSlop={10} style={[styles.skip, { top: insets.top + 12 }]}>
                <ThemedText type="caption" style={{ color: "#fff" }}>
                    Skip
                </ThemedText>
            </Pressable>

            {isSwipeStep && (
                <View style={styles.center} pointerEvents="none">
                    <Animated.View style={{ transform: [{ translateX }] }}>
                        {step === "swipeRight" ? (
                            <CaretRight size={64} color="#fff" weight="bold" />
                        ) : (
                            <CaretLeft size={64} color="#fff" weight="bold" />
                        )}
                    </Animated.View>
                    <ThemedText type="defaultSemiBold" style={styles.centerCopy}>
                        {COPY[step]}
                    </ThemedText>
                </View>
            )}

            {step === "homeButton" && (
                <Pressable onPress={onHomeButtonPress} style={[styles.callout, { bottom: insets.bottom + 96, right: 16 }]}>
                    <House size={20} color="#fff" weight="regular" />
                    <ThemedText type="defaultSemiBold" style={styles.calloutCopy}>
                        {COPY.homeButton}
                    </ThemedText>
                </Pressable>
            )}

            {step === "focusMode" && (
                <Pressable
                    onPress={onFocusModePress}
                    style={[styles.callout, { top: insets.top + 56, right: HORIZONTAL_PADDING }]}>
                    <Moon size={20} color="#fff" weight="regular" />
                    <ThemedText type="defaultSemiBold" style={styles.calloutCopy}>
                        {COPY.focusMode}
                    </ThemedText>
                </Pressable>
            )}

            <View style={[styles.dots, { bottom: insets.bottom + 32 }]} pointerEvents="none">
                {Array.from({ length: totalSteps }).map((_, i) => (
                    <View key={i} style={[styles.dot, { backgroundColor: i <= stepIndex ? "#fff" : "rgba(255,255,255,0.35)" }]} />
                ))}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    skip: {
        position: "absolute",
        right: 20,
        zIndex: 10,
        elevation: 10,
    },
    center: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: 18,
        paddingHorizontal: 40,
        zIndex: 10,
        elevation: 10,
    },
    centerCopy: {
        color: "#fff",
        fontSize: 18,
        textAlign: "center",
    },
    callout: {
        position: "absolute",
        maxWidth: 220,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        borderRadius: 16,
        padding: 14,
        zIndex: 10,
        elevation: 10,
        backgroundColor: "rgba(255,255,255,0.14)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.25)",
    },
    calloutCopy: {
        flex: 1,
        fontSize: 14,
        color: "#fff",
    },
    dots: {
        position: "absolute",
        left: 0,
        right: 0,
        flexDirection: "row",
        justifyContent: "center",
        gap: 6,
        zIndex: 10,
        elevation: 10,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
});
