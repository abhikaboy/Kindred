import React, { useEffect, useRef, useState } from "react";
import { Animated as RNAnimated, Easing } from "react-native";
import { ThemedText, type ThemedTextProps } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { hapticCompletionBurst } from "@/utils/haptics";

const RAMP_UP_MS = 1200;
const SETTLE_MS = 300;
const FLASH_IN_MS = 150;
const FLASH_HOLD_MS = 700;
const FLASH_OUT_MS = 300;

const AnimatedThemedText = RNAnimated.createAnimatedComponent(ThemedText);

/** Onboarding payoff: counts 0 to target on an exponential curve, flashes success green, then taps haptic. */
export default function ScoreRamp({
    target,
    playing,
    onDone,
    type = "subtitle",
}: {
    target: number;
    playing: boolean;
    onDone?: () => void;
    type?: ThemedTextProps["type"];
}) {
    const ThemedColor = useThemeColor();
    const progress = useRef(new RNAnimated.Value(playing ? 0 : 1)).current;
    const flash = useRef(new RNAnimated.Value(0)).current;
    const [shown, setShown] = useState(playing ? 0 : target);
    const onDoneRef = useRef(onDone);
    onDoneRef.current = onDone;

    useEffect(() => {
        const id = progress.addListener(({ value }) => setShown(Math.round(value * target)));
        return () => progress.removeListener(id);
    }, [progress, target]);

    useEffect(() => {
        if (!playing) return;
        progress.setValue(0);
        flash.setValue(0);
        const anim = RNAnimated.sequence([
            RNAnimated.timing(progress, {
                toValue: 1,
                duration: RAMP_UP_MS,
                easing: Easing.out(Easing.exp),
                useNativeDriver: false,
            }),
            RNAnimated.timing(progress, { toValue: 1, duration: SETTLE_MS, useNativeDriver: false }),
        ]);
        const glow = RNAnimated.sequence([
            RNAnimated.timing(flash, { toValue: 1, duration: FLASH_IN_MS, useNativeDriver: false }),
            RNAnimated.delay(FLASH_HOLD_MS),
            RNAnimated.timing(flash, { toValue: 0, duration: FLASH_OUT_MS, useNativeDriver: false }),
        ]);
        RNAnimated.parallel([anim, glow]).start(({ finished }) => {
            if (!finished) return;
            hapticCompletionBurst();
            onDoneRef.current?.();
        });
        return () => {
            progress.stopAnimation();
            flash.stopAnimation();
        };
    }, [playing, progress, flash]);

    const color = flash.interpolate({
        inputRange: [0, 1],
        outputRange: [ThemedColor.text, ThemedColor.success],
    });

    return (
        <AnimatedThemedText type={type} style={{ color, fontVariant: ["tabular-nums"] }}>
            {playing ? shown : target}
        </AnimatedThemedText>
    );
}
