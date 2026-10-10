import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, useColorScheme, View } from "react-native";
import { Easing, runOnJS, useSharedValue, withTiming } from "react-native-reanimated";
import { FadingBlurView } from "@/components/onboarding/FadingBlurView";
import { spotlightBands, type Rect } from "@/utils/onboardingV2/spotlightRects";

type Props = {
    /** Target rect in WINDOW coordinates (from measureInWindow). */
    frame: Rect | null;
    active: boolean;
    padding?: number;
    intensity?: number;
    /** Fade duration; the host lengthens it to introduce the blur gradually. */
    fadeMs?: number;
    testID?: string;
};

/** Blurs everything except the target, which stays sharp. Never intercepts touches. */
const CoachSpotlight = ({ frame, active, padding = 8, intensity = 14, fadeMs = 200, testID = "coach-spotlight" }: Props) => {
    // "light"/"dark" reads as a clean frost; "default" casts muddy gray on light UIs.
    const tint = useColorScheme() === "dark" ? "dark" : "light";
    const show = active && frame !== null;

    const rootRef = useRef<View>(null);
    const [origin, setOrigin] = useState({ x: 0, y: 0 });
    const [size, setSize] = useState({ width: 0, height: 0 });
    const progress = useSharedValue(show ? 1 : 0);
    const [mounted, setMounted] = useState(show);

    useEffect(() => {
        if (show) setMounted(true);
        progress.value = withTiming(show ? 1 : 0, { duration: fadeMs, easing: Easing.out(Easing.cubic) }, (finished) => {
            if (finished && !show) runOnJS(setMounted)(false);
        });
    }, [show, fadeMs, progress]);

    if (!frame || !mounted) return null;

    const local: Rect = { x: frame.x - origin.x, y: frame.y - origin.y, width: frame.width, height: frame.height };
    const bands = spotlightBands({ x: 0, y: 0, width: size.width, height: size.height }, local, padding);
    const measured = size.width > 0 && size.height > 0;
    const placed = (r: Rect) => ({ position: "absolute" as const, left: r.x, top: r.y, width: r.width, height: r.height });

    return (
        <View
            ref={rootRef}
            testID={testID}
            pointerEvents="none"
            onLayout={(e) => {
                const { width, height } = e.nativeEvent.layout;
                setSize({ width, height });
                rootRef.current?.measureInWindow?.((x, y) => setOrigin({ x, y }));
            }}
            style={StyleSheet.absoluteFill}>
            {measured
                ? [bands.top, bands.bottom, bands.left, bands.right].map((band, i) =>
                      band ? (
                          <FadingBlurView
                              key={i}
                              intensity={intensity}
                              progress={progress}
                              tint={tint}
                              pointerEvents="none"
                              testID={`${testID}-band-${i}`}
                              style={placed(band)}
                          />
                      ) : null
                  )
                : null}
        </View>
    );
};

export default CoachSpotlight;
