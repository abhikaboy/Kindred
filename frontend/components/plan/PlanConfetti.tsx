import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import ConfettiCannon from "react-native-confetti-cannon";
import { useThemeColor } from "@/hooks/useThemeColor";

const { width, height } = Dimensions.get("screen");
const BURST_MS = 3200;

export type PlanConfettiHandle = { start: () => void };

// Brand-only burst for committing to a plan: purple, light purple, yellow, green
// and white. Never red. Mounted only while firing: an idle cannon renders its pieces at the origin.
const PlanConfetti = forwardRef<PlanConfettiHandle>((_, ref) => {
    const ThemedColor = useThemeColor();
    const [burst, setBurst] = useState(0);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const colors = useMemo(() => [ThemedColor.primary, "#B899FF", "#FFD66B", "#5FD68A", "#FFFFFF"], [ThemedColor.primary]);

    useImperativeHandle(ref, () => ({
        start: () => {
            setBurst((b) => b + 1);
            if (timer.current) clearTimeout(timer.current);
            timer.current = setTimeout(() => setBurst(0), BURST_MS);
        },
    }));

    useEffect(() => () => {
        if (timer.current) clearTimeout(timer.current);
    }, []);

    if (!burst) return null;
    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <ConfettiCannon
                key={burst}
                count={110}
                origin={{ x: width / 2, y: height * 0.62 }}
                explosionSpeed={350}
                fallSpeed={1600}
                fadeOut
                colors={colors}
            />
        </View>
    );
});

PlanConfetti.displayName = "PlanConfetti";

export default PlanConfetti;
