import React from "react";
import { StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { LinearGradient } from "expo-linear-gradient";
import Reanimated, { Easing, useAnimatedStyle, withTiming, type SharedValue } from "react-native-reanimated";

// Shared by the full-screen composers (quick capture, create): the dimmed
// backdrop, the glass surfaces and the white-on-dark palette they sit in.

let LIQUID_GLASS = false;
try {
    LIQUID_GLASS = isLiquidGlassAvailable();
} catch {
    LIQUID_GLASS = false;
}

export const ON_DARK = "#ffffff";
export const ON_DARK_MUTED = "rgba(255,255,255,0.6)";
export const GLASS = "rgba(255,255,255,0.12)";

/**
 * The stage's only entrance: a short fade with a few pixels of drift, so
 * content that swaps in reads as settling rather than arriving. Entering only;
 * exiting animations inside a Modal can crash on iOS.
 */
export const SOFT_ENTER = () => {
    "worklet";
    const timing = { duration: 200, easing: Easing.out(Easing.cubic) };
    return {
        initialValues: { opacity: 0, transform: [{ translateY: 4 }] },
        animations: { opacity: withTiming(1, timing), transform: [{ translateY: withTiming(0, timing) }] },
    };
};

/**
 * Flat palette for controls on the black scrim, the same in both themes (theme
 * grays read as dull cards on black). White-alpha fills, white text, and solid
 * white for the one selected option; primary is kept for the main action.
 */
export const STAGE = {
    text: ON_DARK,
    muted: ON_DARK_MUTED,
    faint: "rgba(255,255,255,0.4)",
    fill: "rgba(255,255,255,0.1)",
    fillRaised: "rgba(255,255,255,0.16)",
    hairline: "rgba(255,255,255,0.14)",
    selected: "#FFFFFF",
    onSelected: "#13121F",
};

// Liquid glass on iOS 26; the flat translucent fill everywhere else.
export const Glass = ({
    style,
    interactive,
    children,
}: {
    style?: any;
    interactive?: boolean;
    children?: React.ReactNode;
}) =>
    LIQUID_GLASS ? (
        <GlassView
            // Forced dark: "auto"/regular samples the light dashboard behind the
            // backdrop and turns milky gray, which washes out the white text.
            glassEffectStyle="clear"
            colorScheme="dark"
            tintColor="rgba(0,0,0,0.32)"
            isInteractive={interactive}
            style={style}>
            {children}
        </GlassView>
    ) : (
        <View style={[style, { backgroundColor: GLASS }]}>{children}</View>
    );

/**
 * The voice overlay's dimmed backdrop, faded by `opacity` (0 to 1). Dark by
 * default; pass the app's `color` (its background) and `tint` so it follows
 * the current theme instead.
 *
 * The blur is a fixed intensity faded by opacity. Animating BlurView's
 * intensity renders inconsistently (and shows up in screenshots).
 */
export const CaptureBackdrop = ({
    opacity,
    color,
    tint = "dark",
}: {
    opacity: SharedValue<number>;
    /** 6-digit hex the scrim fades toward; black when omitted. */
    color?: string;
    tint?: "light" | "dark";
}) => {
    const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
    // Same falloff either way, anchored where the content sits
    const scrim = color
        ? [color + "00", color + "47", color + "C7", color + "EB"]
        : ["transparent", "rgba(0,0,0,0.28)", "rgba(0,0,0,0.78)", "rgba(0,0,0,0.92)"];
    return (
        <Reanimated.View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
            <BlurView intensity={18} tint={tint} style={StyleSheet.absoluteFill} />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: color ? color + "3D" : "rgba(0,0,0,0.24)" }]} />
            <LinearGradient colors={scrim as any} locations={[0, 0.28, 0.62, 1]} style={StyleSheet.absoluteFill} />
        </Reanimated.View>
    );
};

