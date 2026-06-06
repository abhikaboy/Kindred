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

// Full orbit around the perimeter takes ~1/BORDER_SPEED seconds.
const BORDER_SPEED = 0.045;
// Coordinates live in a 0..100 viewBox, stretched to fill the container.
const VB = 100;
const PERIMETER = 4 * VB;
// Blob radius in viewBox units.
const RADIUS = 40;

type BlobConfig = {
    phase: number;
    baseOpacity: number;
    shimmerFreq: number;
};

// 4 pools spread evenly around the perimeter, each with its own shimmer cadence.
const BLOB_CONFIGS: BlobConfig[] = [
    { phase: 0.0, baseOpacity: 0.85, shimmerFreq: 0.9 },
    { phase: 0.25, baseOpacity: 0.8, shimmerFreq: 1.2 },
    { phase: 0.5, baseOpacity: 0.85, shimmerFreq: 0.7 },
    { phase: 0.75, baseOpacity: 0.8, shimmerFreq: 1.05 },
];

const DEFAULT_COLORS = ["#854DFF", "#A87BFF", "#FF6EC7", "#A87BFF"];

type BorderGlowProps = {
    /** Blob colors, cycled across the 4 pools. Defaults to brand purple + pink accent. */
    colors?: string[];
    /** Fades the glow in and brightens it while true; hidden when false. */
    active?: boolean;
    /** Base strength multiplier (0..1). */
    intensity?: number;
    style?: StyleProp<ViewStyle>;
};

/** Reusable screen-edge glow — color pools orbit the perimeter. Fills its parent, never blocks touches. */
export const BorderGlow: React.FC<BorderGlowProps> = ({
    colors = DEFAULT_COLORS,
    active = false,
    intensity = 0.8,
    style,
}) => {
    const time = useSharedValue(0);
    // 0 = hidden, 1 = fully present. Gates opacity so the glow only shows while active.
    const glow = useSharedValue(active ? 1 : 0);
    const baseId = useId().replace(/:/g, "");

    useEffect(() => {
        glow.value = withTiming(active ? 1 : 0, {
            duration: 700,
            easing: Easing.inOut(Easing.ease),
        });
    }, [active, glow]);

    useFrameCallback((frame) => {
        const dtMs = frame.timeSincePreviousFrame ?? 16;
        time.value += (dtMs / 1000) * BORDER_SPEED;
    });

    return (
        <View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
            <Svg
                width="100%"
                height="100%"
                viewBox={`0 0 ${VB} ${VB}`}
                preserveAspectRatio="none"
            >
                <Defs>
                    {BLOB_CONFIGS.map((_, i) => (
                        <RadialGradient key={i} id={`${baseId}-${i}`} cx="50%" cy="50%" r="50%">
                            <Stop offset="0" stopColor={colors[i % colors.length]} stopOpacity="1" />
                            <Stop offset="1" stopColor={colors[i % colors.length]} stopOpacity="0" />
                        </RadialGradient>
                    ))}
                </Defs>
                {BLOB_CONFIGS.map((config, i) => (
                    <BorderBlob
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

type BorderBlobProps = {
    config: BlobConfig;
    gradientId: string;
    time: SharedValue<number>;
    glow: SharedValue<number>;
    intensity: number;
};

const BorderBlob: React.FC<BorderBlobProps> = ({ config, gradientId, time, glow, intensity }) => {
    const animatedProps = useAnimatedProps(() => {
        // Walk the rectangle perimeter (0..100 viewBox): t in [0,1) maps to a point on the edge.
        const t = (time.value + config.phase) % 1;
        const p = t * PERIMETER;
        let cx: number;
        let cy: number;
        if (p < VB) {
            cx = p;
            cy = 0;
        } else if (p < 2 * VB) {
            cx = VB;
            cy = p - VB;
        } else if (p < 3 * VB) {
            cx = VB - (p - 2 * VB);
            cy = VB;
        } else {
            cx = 0;
            cy = VB - (p - 3 * VB);
        }
        const shimmer = 1 + 0.15 * Math.sin(time.value * config.shimmerFreq * 6.28 + config.phase * 6.28);
        const opacity = Math.min(1, intensity * config.baseOpacity * glow.value * shimmer);
        return { cx, cy, opacity };
    });

    return (
        <AnimatedCircle
            r={RADIUS}
            fill={`url(#${gradientId})`}
            animatedProps={animatedProps}
        />
    );
};

export default BorderGlow;
