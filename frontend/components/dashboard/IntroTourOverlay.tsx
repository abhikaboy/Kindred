import React, { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, useColorScheme, View } from "react-native";
import { BlurView } from "expo-blur";
import { ArrowUp, CaretLeft, CaretRight, Moon } from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedText } from "@/components/ThemedText";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import type { IntroStep } from "@/hooks/useIntroTour";
import { useFocusButtonRect } from "@/hooks/useFocusButtonRect";

type Props = {
    active: boolean;
    step: IntroStep | null;
    stepIndex: number;
    totalSteps: number;
    onFocusModePress: () => void;
    onSkip: () => void;
};

const COPY: Record<IntroStep, string> = {
    swipeRight: "Swipe right for your workspaces",
    swipeLeft: "Swipe left for your calendar & list view",
    focusMode: "Tap the moon for Focus mode: just today's tasks, nothing else",
};

export const IntroTourOverlay: React.FC<Props> = ({
    active,
    step,
    stepIndex,
    totalSteps,
    onFocusModePress,
    onSkip,
}) => {
    const tint = useColorScheme() === "dark" ? "dark" : "light";
    const insets = useSafeAreaInsets();
    const bounce = useRef(new Animated.Value(0)).current;
    const pulse = useRef(new Animated.Value(0)).current;
    const focusRect = useFocusButtonRect();
    const arrowNudge = pulse.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -4, 0] });

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

    // Focus step: a halo breathes out from the real moon button
    useEffect(() => {
        if (step !== "focusMode") return;
        pulse.setValue(0);
        const loop = Animated.loop(
            Animated.timing(pulse, { toValue: 1, duration: 1400, useNativeDriver: true })
        );
        loop.start();
        return () => loop.stop();
    }, [step, pulse]);

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

            {step === "focusMode" && focusRect && (() => {
                const size = Math.max(focusRect.width, focusRect.height) + 16;
                const cx = focusRect.x + focusRect.width / 2;
                const cy = focusRect.y + focusRect.height / 2;
                const ring = { left: cx - size / 2, top: cy - size / 2, width: size, height: size, borderRadius: size / 2 };
                return (
                    <>
                        {/* Halo + ring sit exactly on the real button, above the blur */}
                        <Animated.View
                            pointerEvents="none"
                            style={[
                                styles.focusHalo,
                                ring,
                                {
                                    opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
                                    transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.8] }) }],
                                },
                            ]}
                        />
                        <Pressable onPress={onFocusModePress} hitSlop={12} style={[styles.focusRing, ring]}>
                            <Moon size={22} color="#fff" weight="fill" />
                        </Pressable>
                        {/* Arrow centered under the button, callout just below it */}
                        <Animated.View
                            pointerEvents="none"
                            style={[styles.focusArrow, { left: cx - 10, top: ring.top + size + 4, transform: [{ translateY: arrowNudge }] }]}>
                            <ArrowUp size={20} color="#fff" weight="bold" />
                        </Animated.View>
                        <Pressable
                            onPress={onFocusModePress}
                            style={[styles.callout, styles.focusCallout, { top: ring.top + size + 32, right: HORIZONTAL_PADDING }]}>
                            <ThemedText type="defaultSemiBold" style={styles.calloutCopy}>
                                {COPY.focusMode}
                            </ThemedText>
                        </Pressable>
                    </>
                );
            })()}

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
    focusHalo: {
        position: "absolute",
        backgroundColor: "rgba(255,255,255,0.5)",
        zIndex: 10,
        elevation: 10,
    },
    focusRing: {
        position: "absolute",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 2,
        borderColor: "#fff",
        backgroundColor: "rgba(255,255,255,0.16)",
        zIndex: 11,
        elevation: 11,
    },
    focusCallout: {
        position: "absolute",
        zIndex: 11,
        elevation: 11,
    },
    focusArrow: {
        position: "absolute",
        zIndex: 11,
        elevation: 11,
    },
    callout: {
        maxWidth: 240,
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
