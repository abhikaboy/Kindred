import React, { useEffect, useId } from "react";
import { StyleProp, ViewStyle, View, StyleSheet } from "react-native";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import Animated, {
    useSharedValue,
    useAnimatedProps,
    useFrameCallback,
    withTiming,
    Easing,
    type SharedValue,
} from "react-native-reanimated";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Drift speed in "phase units" per second; blob sine frequencies are tuned around this.
const BASE_SPEED = 0.9;
// Coordinates are normalized to a 100x100 viewBox so the glow scales to any container.
const VIEWBOX = 100;

type BlobConfig = {
    bx: number;
    by: number;
    r: number;
    ampX: number;
    ampY: number;
    fx: number;
    fy: number;
    phase: number;
    baseOpacity: number;
};

// 3 overlapping blobs on independent slow loops so the motion never visibly repeats.
const BLOB_CONFIGS: BlobConfig[] = [
    { bx: 42, by: 54, r: 42, ampX: 10, ampY: 8, fx: 0.5, fy: 0.42, phase: 0, baseOpacity: 0.5 },
    { bx: 60, by: 46, r: 36, ampX: 12, ampY: 10, fx: 0.4, fy: 0.55, phase: 2.1, baseOpacity: 0.45 },
    { bx: 52, by: 61, r: 28, ampX: 14, ampY: 11, fx: 0.6, fy: 0.48, phase: 4.2, baseOpacity: 0.42 },
];

const DEFAULT_COLORS = ["#854DFF", "#A87BFF", "#FF6EC7"];

type GlowOverlayProps = {
    /** Blob colors, cycled if fewer than blobCount. Defaults to brand purple + pink accent. */
    colors?: string[];
    /** When true, the glow brightens and drifts faster. */
    active?: boolean;
    /** Number of blobs to render (1-3). */
    blobCount?: number;
    /** Base strength multiplier (0..1). */
    intensity?: number;
    style?: StyleProp<ViewStyle>;
};

/** Reusable ambient glow — soft drifting color blobs. Fills its parent; never intercepts touches. */
export const GlowOverlay: React.FC<GlowOverlayProps> = ({
    colors = DEFAULT_COLORS,
    active = false,
    blobCount = 3,
    intensity = 0.6,
    style,
}) => {
    const time = useSharedValue(0);
    // 0 = ambient, 1 = active. Smoothly ramps on state change.
    const glow = useSharedValue(active ? 1 : 0);
    const baseId = useId().replace(/:/g, "");

    useEffect(() => {
        glow.value = withTiming(active ? 1 : 0, {
            duration: 600,
            easing: Easing.inOut(Easing.ease),
        });
    }, [active, glow]);

    useFrameCallback((frame) => {
        const dtMs = frame.timeSincePreviousFrame ?? 16;
        // Active state speeds drift up ~70%.
        time.value += (dtMs / 1000) * BASE_SPEED * (1 + 0.7 * glow.value);
    });

    const count = Math.max(1, Math.min(blobCount, BLOB_CONFIGS.length));

    return (
        <View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
            <Svg width="100%" height="100%" viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}>
                <Defs>
                    {BLOB_CONFIGS.slice(0, count).map((_, i) => (
                        <RadialGradient key={i} id={`${baseId}-${i}`} cx="50%" cy="50%" r="50%">
                            <Stop offset="0" stopColor={colors[i % colors.length]} stopOpacity="1" />
                            <Stop offset="1" stopColor={colors[i % colors.length]} stopOpacity="0" />
                        </RadialGradient>
                    ))}
                </Defs>
                {BLOB_CONFIGS.slice(0, count).map((config, i) => (
                    <GlowBlob
                        key={i}
                        config={config}
                        gradientId={`${baseId}-${i}`}
                        time={time}
                        glow={glow}
                        intensity={intensity}
                    />
                ))}
            </Svg>
        </View>
    );
};

type GlowBlobProps = {
    config: BlobConfig;
    gradientId: string;
    time: SharedValue<number>;
    glow: SharedValue<number>;
    intensity: number;
};

const GlowBlob: React.FC<GlowBlobProps> = ({ config, gradientId, time, glow, intensity }) => {
    const animatedProps = useAnimatedProps(() => {
        const t = time.value;
        const cx = config.bx + config.ampX * Math.sin(t * config.fx + config.phase);
        const cy = config.by + config.ampY * Math.cos(t * config.fy + config.phase);
        // Gentle independent shimmer, plus a brightness lift while active.
        const shimmer = 1 + 0.12 * Math.sin(t * 1.1 + config.phase);
        const opacity = Math.min(
            1,
            intensity * config.baseOpacity * (1 + 0.4 * glow.value) * shimmer
        );
        return { cx, cy, opacity };
    });

    return (
        <AnimatedCircle
            r={config.r}
            fill={`url(#${gradientId})`}
            animatedProps={animatedProps}
        />
    );
};

export default GlowOverlay;
