import React, { useEffect, useRef, useState } from "react";
import { View, StyleSheet, Animated } from "react-native";
import Svg, { Path } from "react-native-svg";
import { ThemedText } from "@/components/ThemedText";

const PURPLE = "#854DFF";

type Props = {
    size?: number;
    label?: string; // optional Figma-style speech bubble (typewriters in)
    bubbleLeft?: boolean; // anchor the bubble to the left (for right-edge cursors)
    arrowScale?: Animated.Value; // pulse the ARROW only — the bubble never scales
    color?: string; // cursor + bubble color (e.g. a friend's cursor is red)
};

// Figma-style arrow cursor: colored fill, white outline, drop shadow, optional
// label bubble. It fades + slides in on mount (never just spawns) and the label
// typewriters in.
export default function TutorialCursor({ size = 32, label, bubbleLeft = false, arrowScale, color = PURPLE }: Props) {
    const enter = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        Animated.timing(enter, { toValue: 1, duration: 450, useNativeDriver: true }).start();
    }, []);
    const enterStyle = {
        opacity: enter,
        transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [22, 0] }) }],
    };

    const [typed, setTyped] = useState("");
    useEffect(() => {
        if (!label) return;
        let i = 0;
        let cancelled = false;
        const tick = () => {
            if (cancelled) return;
            i++;
            setTyped(label.slice(0, i));
            if (i < label.length) setTimeout(tick, 45);
        };
        const start = setTimeout(tick, 400); // begin after the cursor has slid in
        return () => {
            cancelled = true;
            clearTimeout(start);
        };
    }, [label]);

    const arrow = (
        <Animated.View style={[styles.arrowShadow, arrowScale ? { transform: [{ scale: arrowScale }] } : null]}>
            <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
                <Path
                    d="M4 4l7.07 17 2.51-7.39L21 11.07z"
                    fill={color}
                    stroke="#FFFFFF"
                    strokeWidth={1.6}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                />
            </Svg>
        </Animated.View>
    );

    if (!label) return <Animated.View style={enterStyle}>{arrow}</Animated.View>;

    return (
        <Animated.View style={[styles.row, bubbleLeft && styles.rowReverse, enterStyle]}>
            {arrow}
            <View style={[styles.bubble, { backgroundColor: color + "B3" }, bubbleLeft ? styles.bubbleTuckLeft : styles.bubbleTuckRight]}>
                <ThemedText type="defaultSemiBold" numberOfLines={1} style={styles.bubbleText}>
                    {typed}
                </ThemedText>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: "row",
        alignItems: "flex-start",
    },
    rowReverse: {
        flexDirection: "row-reverse",
    },
    arrowShadow: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 16,
    },
    bubble: {
        marginTop: 8,
        borderRadius: 999,
        paddingHorizontal: 14,
        paddingVertical: 7,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 8,
    },
    bubbleTuckRight: {
        marginLeft: -6,
    },
    bubbleTuckLeft: {
        marginRight: -6,
    },
    bubbleText: {
        color: "#FFFFFF",
    },
});
