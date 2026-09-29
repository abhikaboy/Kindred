import React, { useCallback, useRef, useState } from "react";
import { LayoutChangeEvent, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { isCheck, type Point } from "@/utils/checkGesture";

type Props = {
    /** True once committed: the pad glows and the hint reads "You're in." */
    done: boolean;
    onCheck: () => void;
};

const HINT_IDLE = "Draw a check to commit";
const HINT_MISS = "A quick check works. Down, then up.";
const HINT_DONE = "You're in.";

const toPath = (pts: Point[]) =>
    pts.length ? `M${pts[0].x} ${pts[0].y}` + pts.slice(1).map((p) => ` L${p.x} ${p.y}`).join("") : "";

/**
 * A soft pad the user draws a check on to commit. The stroke is recognised on
 * release; a miss fades out and the hint explains the shape.
 */
export default function CheckPad({ done, onCheck }: Props) {
    const ThemedColor = useThemeColor();
    const points = useRef<Point[]>([]);
    const [path, setPath] = useState("");
    const [missed, setMissed] = useState(false);
    const [size, setSize] = useState({ width: 0, height: 0 });
    const strokeOpacity = useSharedValue(1);
    const ghostOpacity = useSharedValue(1);

    const begin = useCallback((p: Point) => {
        // A new stroke interrupts any fade in progress
        strokeOpacity.value = 1;
        ghostOpacity.value = withTiming(0, { duration: 180 });
        points.current = [p];
        setPath(toPath(points.current));
    }, []);

    const move = useCallback((p: Point) => {
        points.current.push(p);
        setPath(toPath(points.current));
    }, []);

    const end = useCallback(() => {
        if (isCheck(points.current)) {
            onCheck();
            return;
        }
        strokeOpacity.value = withTiming(0, { duration: 180 });
        ghostOpacity.value = withTiming(1, { duration: 180 });
        setMissed(true);
    }, [onCheck]);

    const pan = Gesture.Pan()
        .runOnJS(true)
        .minDistance(0)
        .enabled(!done)
        .onBegin((e) => begin({ x: e.x, y: e.y }))
        .onUpdate((e) => move({ x: e.x, y: e.y }))
        .onFinalize(() => end());

    const strokeStyle = useAnimatedStyle(() => ({ opacity: strokeOpacity.value }));
    const ghostStyle = useAnimatedStyle(() => ({ opacity: ghostOpacity.value }));

    const onLayout = (e: LayoutChangeEvent) => setSize(e.nativeEvent.layout);

    const hint = done ? HINT_DONE : missed ? HINT_MISS : HINT_IDLE;

    return (
        <View>
            <GestureDetector gesture={pan}>
                <View
                    onLayout={onLayout}
                    accessibilityLabel="Draw a check to commit"
                    style={[
                        styles.pad,
                        { backgroundColor: ThemedColor.lightened },
                        done && { shadowColor: ThemedColor.primary, shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
                    ]}>
                    <Animated.View style={[styles.ghost, ghostStyle]} pointerEvents="none">
                        <Svg width="100%" height="100%" viewBox="0 0 200 120">
                            <Path
                                d="M50 62 L86 94 L152 30"
                                fill="none"
                                stroke={ThemedColor.caption}
                                strokeOpacity={0.35}
                                strokeWidth={6}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeDasharray="2 14"
                            />
                        </Svg>
                    </Animated.View>
                    <Animated.View style={[StyleSheet.absoluteFill, strokeStyle]} pointerEvents="none">
                        <Svg width={size.width} height={size.height}>
                            <Path
                                d={path}
                                fill="none"
                                stroke={ThemedColor.primary}
                                strokeWidth={8}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </Svg>
                    </Animated.View>
                </View>
            </GestureDetector>
            <Animated.View key={hint} entering={FadeIn.duration(180)}>
                <ThemedText type="caption" style={styles.hint}>
                    {hint}
                </ThemedText>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    pad: {
        height: 200,
        marginTop: 24,
        borderRadius: 24,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 2,
    },
    ghost: {
        position: "absolute",
        top: 24,
        bottom: 24,
        left: 40,
        right: 40,
    },
    hint: {
        textAlign: "center",
        marginTop: 12,
    },
});
