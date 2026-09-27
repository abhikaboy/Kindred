import React, { useEffect, useId, useState } from "react";
import { StyleSheet, View, useColorScheme } from "react-native";
import Animated, {
    Easing,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withDelay,
    withRepeat,
    withSequence,
    withTiming,
} from "react-native-reanimated";
import Svg, { Defs, Ellipse, LinearGradient, RadialGradient, Rect, Stop } from "react-native-svg";

export type GlowBlob = {
    color: string;
    /** peak gradient opacity per theme */
    opacity: { dark: number; light: number };
    /** 0-100 screen-space coords; the viewBox stretches to fill the parent */
    cx: number;
    cy: number;
    rx: number;
    ry: number;
    /** gradient falloff radius, default "50%" */
    falloff?: string;
};

const hexToRgb = (hex: string) => {
    const n = parseInt(hex.replace("#", ""), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const BRAND_PURPLE = "#854DFF";

// averages the blob hues, then lifts toward white so the wash reads as a pastel tint, never gray
function paleTint(colors: string[], lift = 0.8) {
    const rgbs = colors.map(hexToRgb);
    const avg = [0, 1, 2].map((c) => rgbs.reduce((s, rgb) => s + rgb[c], 0) / rgbs.length);
    const [r, g, b] = avg.map((v) => Math.round(v + (255 - v) * lift));
    return `rgb(${r},${g},${b})`;
}

// fraction of screen height the wash sinks after its initial tall bloom
const SETTLE_DROP = 0.2;

/** Opens tall, sinks toward the bottom, then breathes. Transform/opacity only, so it stays on the UI thread. */
function LightWash({ id }: { id: string }) {
    const tint = paleTint([BRAND_PURPLE], 0.82);
    const reduceMotion = useReducedMotion();
    const [height, setHeight] = useState(0);
    const drop = useSharedValue(reduceMotion ? 1 : 0);
    const breath = useSharedValue(0);

    useEffect(() => {
        if (reduceMotion || !height) return;
        drop.value = withDelay(250, withTiming(1, { duration: 1400, easing: Easing.out(Easing.cubic) }));
        const ease = Easing.inOut(Easing.sin);
        breath.value = withDelay(
            1650,
            withRepeat(withSequence(withTiming(1, { duration: 3200, easing: ease }), withTiming(0, { duration: 3200, easing: ease })), -1)
        );
    }, [height, reduceMotion]);

    const style = useAnimatedStyle(() => ({
        opacity: 0.9 + 0.1 * breath.value,
        transform: [{ translateY: height * (SETTLE_DROP * drop.value - 0.03 * breath.value) }],
    }));

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="none" onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>
            <Animated.View style={[StyleSheet.absoluteFill, style]}>
                <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <Defs>
                        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                            <Stop offset="0.42" stopColor={tint} stopOpacity="0" />
                            <Stop offset="0.66" stopColor={tint} stopOpacity="0.3" />
                            <Stop offset="0.8" stopColor={tint} stopOpacity="0.55" />
                        </LinearGradient>
                    </Defs>
                    <Rect x="0" y="0" width="100" height="100" fill={`url(#${id})`} />
                </Svg>
            </Animated.View>
        </View>
    );
}

// Material 3 motion curves
const EMPHASIZED_DECEL = Easing.bezier(0.05, 0.7, 0.1, 1);
const STANDARD = Easing.bezier(0.2, 0, 0, 1);

/** Content-heavy pages: one soft bloom rises from the bottom edge, then recedes to nothing. */
function LightBloom({ id }: { id: string }) {
    const tint = paleTint([BRAND_PURPLE], 0.8);
    const reduceMotion = useReducedMotion();
    const [height, setHeight] = useState(0);
    const opacity = useSharedValue(0);
    const sink = useSharedValue(0);

    useEffect(() => {
        if (reduceMotion || !height) return;
        opacity.value = withSequence(
            withTiming(1, { duration: 700, easing: EMPHASIZED_DECEL }),
            withDelay(600, withTiming(0, { duration: 1200, easing: STANDARD }))
        );
        sink.value = withDelay(1300, withTiming(1, { duration: 1200, easing: STANDARD }));
    }, [height, reduceMotion]);

    const style = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ translateY: height * 0.12 * sink.value }],
    }));

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="none" onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>
            <Animated.View style={[StyleSheet.absoluteFill, style]}>
                <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <Defs>
                        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                            <Stop offset="0.6" stopColor={tint} stopOpacity="0" />
                            <Stop offset="0.85" stopColor={tint} stopOpacity="0.3" />
                            <Stop offset="1" stopColor={tint} stopOpacity="0.5" />
                        </LinearGradient>
                    </Defs>
                    <Rect x="0" y="0" width="100" height="100" fill={`url(#${id})`} />
                </Svg>
            </Animated.View>
        </View>
    );
}

/** Ambient glow layer — deliberately no animation, it costs frames during scroll.
    Blobs are plain data so arrangements stay per-page config. */
export default function GlowBackground({ blobs, light = "wash" }: { blobs: GlowBlob[]; light?: "wash" | "bloom" | "blobs" }) {
    const scheme = useColorScheme() ?? "light";
    const baseId = useId().replace(/:/g, "");

    // Low-alpha saturated blobs over white look muddy; light mode gets a clean bottom-up pastel wash instead.
    // "blobs" opts light mode into the same layout as dark, at the light opacities.
    if (scheme === "light" && light !== "blobs")
        return light === "bloom" ? <LightBloom id={`${baseId}-bloom`} /> : <LightWash id={`${baseId}-wash`} />;

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
                <Defs>
                    {blobs.map((b, i) => (
                        <RadialGradient key={i} id={`${baseId}-${i}`} cx="50%" cy="50%" r={b.falloff ?? "50%"}>
                            <Stop offset="0" stopColor={b.color} stopOpacity={scheme === "light" ? b.opacity.light : b.opacity.dark} />
                            <Stop offset="1" stopColor={b.color} stopOpacity="0" />
                        </RadialGradient>
                    ))}
                </Defs>
                {blobs.map((b, i) => (
                    <Ellipse key={i} cx={b.cx} cy={b.cy} rx={b.rx} ry={b.ry} fill={`url(#${baseId}-${i})`} />
                ))}
            </Svg>
        </View>
    );
}
