import React, { useEffect, useId, useState } from "react";
import { StyleSheet, View, useColorScheme } from "react-native";
import Animated, {
    Easing,
    SharedValue,
    useAnimatedReaction,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withDelay,
    withRepeat,
    withSequence,
    withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Defs, Ellipse, Mask, Pattern, RadialGradient, Rect, Stop } from "react-native-svg";

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

// Material 3 motion curves
const EMPHASIZED_DECEL = Easing.bezier(0.05, 0.7, 0.1, 1);
const STANDARD = Easing.bezier(0.2, 0, 0, 1);

// fraction of screen height the wash sinks after its initial tall bloom
const SETTLE_DROP = 0.2;
// halftone opacity at full pull; on release it just eases out, no flash
const PULL_DOTS = 0.5;
// halftone grid pitch in px; two dots per tile gives the staggered diamond lattice
const DOT_PITCH = 10;

// wash edge is an ellipse centered near the top, so it dips lowest mid-screen and rides higher at the sides.
// cy/ry are fractions of height, rx of width; stops are [radius, opacity] along that ellipse
const ARC = {
    wash: {
        cy: 0.1,
        ry: 0.7,
        rx: 1.1,
        stops: [
            [0.62, 0],
            [0.85, 0.3],
            [1, 0.55],
        ],
        dots: [
            [0.58, 0],
            [0.7, 1],
            [0.84, 0.35],
            [0.95, 0],
        ],
    },
    bloom: {
        cy: 0.3,
        ry: 0.7,
        rx: 1.1,
        stops: [
            [0.75, 0],
            [0.9, 0.3],
            [1, 0.5],
        ],
        dots: [
            [0.72, 0],
            [0.82, 1],
            [0.92, 0.35],
            [1, 0],
        ],
    },
};
type Arc = (typeof ARC)["wash"];

/** Halftone band riding the wash's leading edge. Pixel-space Svg so dots stay round. */
function WashDots({
    id,
    width,
    height,
    color,
    arc,
}: {
    id: string;
    width: number;
    height: number;
    color: string;
    arc: Arc;
}) {
    return (
        <Svg width={width} height={height}>
            <Defs>
                <Pattern id={`${id}-dot`} patternUnits="userSpaceOnUse" width={DOT_PITCH} height={DOT_PITCH}>
                    <Circle cx={DOT_PITCH / 4} cy={DOT_PITCH / 4} r={1.1} fill={color} />
                    <Circle cx={(DOT_PITCH * 3) / 4} cy={(DOT_PITCH * 3) / 4} r={1.1} fill={color} />
                </Pattern>
                <RadialGradient
                    id={`${id}-band`}
                    gradientUnits="userSpaceOnUse"
                    cx={width / 2}
                    cy={height * arc.cy}
                    rx={width * arc.rx}
                    ry={height * arc.ry}>
                    {arc.dots.map(([offset, opacity]) => (
                        <Stop key={offset} offset={offset} stopColor="#fff" stopOpacity={opacity} />
                    ))}
                </RadialGradient>
                <Mask id={`${id}-mask`}>
                    <Rect width={width} height={height} fill={`url(#${id}-band)`} />
                </Mask>
            </Defs>
            <Rect width={width} height={height} fill={`url(#${id}-dot)`} mask={`url(#${id}-mask)`} />
        </Svg>
    );
}

// both schemes run the same wash; dark keeps the hue saturated since lifting toward white reads as haze on navy
const WASH_TINT = { light: paleTint([BRAND_PURPLE], 0.82), dark: paleTint([BRAND_PURPLE], 0.1) };
const BLOOM_TINT = { light: paleTint([BRAND_PURPLE], 0.8), dark: paleTint([BRAND_PURPLE], 0.1) };
const DOT_TINT = { light: paleTint([BRAND_PURPLE], 0.45), dark: paleTint([BRAND_PURPLE], 0.35) };
const PEAK = { light: 1, dark: 0.45 };

/** Wash opens tall, sinks, then breathes; bloom rises from the bottom edge and recedes. Both open with the halftone band.
    Transform/opacity only, so it stays on the UI thread.
    `pull` (0-1) rewinds the wash toward its tall opening pose; bumping `replay` plays the opening again from wherever it sits. */
function Wash({
    id,
    variant,
    scheme,
    pull,
    replay,
}: {
    id: string;
    variant: "wash" | "bloom";
    scheme: "light" | "dark";
    pull?: SharedValue<number>;
    replay?: SharedValue<number>;
}) {
    const isWash = variant === "wash";
    const tint = (isWash ? WASH_TINT : BLOOM_TINT)[scheme];
    const reduceMotion = useReducedMotion();
    const [size, setSize] = useState({ width: 0, height: 0 });
    const height = size.height;
    const drop = useSharedValue(reduceMotion ? 1 : 0);
    const breath = useSharedValue(0);
    const fade = useSharedValue(reduceMotion || isWash ? 1 : 0);
    const dots = useSharedValue(0);

    // halftone flash, sink, then breathe. `lead` is the hold before the sink: the first open waits a beat, a replay goes at once
    const playWash = (lead: number, replaying = false) => {
        "worklet";
        dots.value = replaying
            ? // replay: the halftone is already showing from the pull, so let it drift out as the wash sinks
              withTiming(0, { duration: 900, easing: STANDARD })
            : withSequence(
                  withDelay(lead - 150, withTiming(1, { duration: 350, easing: EMPHASIZED_DECEL })),
                  // wash lingers on the halftone before fading
                  withDelay(1400, withTiming(0, { duration: 1400, easing: STANDARD }))
              );
        drop.value = withDelay(lead, withTiming(1, { duration: 1400, easing: Easing.out(Easing.cubic) }));
        const ease = Easing.inOut(Easing.sin);
        breath.value = withSequence(
            withTiming(0, { duration: 400, easing: ease }),
            withDelay(
                lead + 1000,
                withRepeat(
                    withSequence(
                        withTiming(1, { duration: 3200, easing: ease }),
                        withTiming(0, { duration: 3200, easing: ease })
                    ),
                    -1
                )
            )
        );
    };

    useEffect(() => {
        if (reduceMotion || !height) return;
        if (isWash) {
            playWash(250);
        } else {
            dots.value = withSequence(
                withDelay(100, withTiming(1, { duration: 350, easing: EMPHASIZED_DECEL })),
                withDelay(350, withTiming(0, { duration: 900, easing: STANDARD }))
            );
            fade.value = withSequence(
                withTiming(1, { duration: 700, easing: EMPHASIZED_DECEL }),
                withDelay(600, withTiming(0, { duration: 1200, easing: STANDARD }))
            );
            drop.value = withDelay(1300, withTiming(1, { duration: 1200, easing: STANDARD }));
        }
    }, [height, reduceMotion, isWash]);

    // release: fold the pull into the wash's own state so nothing jumps, then replay the opening from there
    useAnimatedReaction(
        () => replay?.value ?? 0,
        (next, prev) => {
            if (prev === null || next === prev || !isWash || reduceMotion) return;
            const p = pull?.value ?? 0;
            drop.value = drop.value * (1 - p);
            dots.value = Math.max(dots.value, PULL_DOTS * p);
            if (pull) pull.value = 0;
            playWash(150, true);
        },
        [isWash, reduceMotion]
    );

    const peak = PEAK[scheme];
    const style = useAnimatedStyle(() => {
        const p = isWash && !reduceMotion ? pull?.value ?? 0 : 0;
        return {
            opacity: peak * (isWash ? 0.9 + 0.1 * breath.value : fade.value),
            transform: [
                {
                    translateY:
                        height *
                        (isWash ? SETTLE_DROP * drop.value * (1 - p) - 0.03 * breath.value : 0.12 * drop.value),
                },
            ],
        };
    });
    const dotStyle = useAnimatedStyle(() => ({
        opacity: Math.max(dots.value, isWash && !reduceMotion ? PULL_DOTS * (pull?.value ?? 0) : 0),
    }));
    const arc = ARC[variant];

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="none" onLayout={(e) => setSize(e.nativeEvent.layout)}>
            <Animated.View style={[StyleSheet.absoluteFill, style]}>
                <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <Defs>
                        <RadialGradient
                            id={id}
                            gradientUnits="userSpaceOnUse"
                            cx={50}
                            cy={100 * arc.cy}
                            rx={100 * arc.rx}
                            ry={100 * arc.ry}>
                            {arc.stops.map(([offset, opacity]) => (
                                <Stop key={offset} offset={offset} stopColor={tint} stopOpacity={opacity} />
                            ))}
                        </RadialGradient>
                    </Defs>
                    <Rect x="0" y="0" width="100" height="100" fill={`url(#${id})`} />
                </Svg>
                {!reduceMotion && size.width > 0 && (
                    <Animated.View style={[StyleSheet.absoluteFill, dotStyle]}>
                        <WashDots
                            id={`${id}-dots`}
                            width={size.width}
                            height={size.height}
                            color={DOT_TINT[scheme]}
                            arc={arc}
                        />
                    </Animated.View>
                )}
            </Animated.View>
        </View>
    );
}

/** Ambient glow layer. Light and dark share the same wash/bloom so pages look and move identically in both.
    "blobs" opts into the static per-page radial layout, also in both schemes. */
export default function GlowBackground({
    blobs,
    light = "wash",
    pull,
    replay,
}: {
    blobs: GlowBlob[];
    light?: "wash" | "bloom" | "blobs";
    /** 0-1 pull-to-refresh progress; lifts the wash back toward its opening pose */
    pull?: SharedValue<number>;
    /** increment to replay the opening (pull-to-refresh release) */
    replay?: SharedValue<number>;
}) {
    const scheme = useColorScheme() === "dark" ? "dark" : "light";
    const baseId = useId().replace(/:/g, "");

    if (light !== "blobs")
        return <Wash id={`${baseId}-${light}`} variant={light} scheme={scheme} pull={pull} replay={replay} />;

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
                <Defs>
                    {blobs.map((b, i) => (
                        <RadialGradient key={i} id={`${baseId}-${i}`} cx="50%" cy="50%" r={b.falloff ?? "50%"}>
                            <Stop offset="0" stopColor={b.color} stopOpacity={b.opacity[scheme]} />
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
