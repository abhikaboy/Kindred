import React, { useEffect, useState } from "react";
import { StyleSheet, useColorScheme, View } from "react-native";
import { Easing, runOnJS, useSharedValue, withTiming } from "react-native-reanimated";
import { FadingBlurView } from "@/components/onboarding/FadingBlurView";

type Props = {
    active: boolean;
};

/** Passive blur behind Home while a coach is active. Never intercepts touches. */
const CoachBackdrop = ({ active }: Props) => {
    // "light"/"dark" reads as a clean frost; "default" casts muddy gray on light UIs.
    const tint = useColorScheme() === "dark" ? "dark" : "light";
    const progress = useSharedValue(active ? 1 : 0);
    const [mounted, setMounted] = useState(active);

    useEffect(() => {
        if (active) setMounted(true);
        progress.value = withTiming(active ? 1 : 0, { duration: 200, easing: Easing.out(Easing.cubic) }, (finished) => {
            if (finished && !active) runOnJS(setMounted)(false);
        });
    }, [active, progress]);

    if (!mounted) return null;

    return (
        <View testID="coach-backdrop" pointerEvents="none" style={StyleSheet.absoluteFill}>
            <FadingBlurView intensity={22} progress={progress} tint={tint} pointerEvents="none" style={StyleSheet.absoluteFill} />
        </View>
    );
};

export default CoachBackdrop;
