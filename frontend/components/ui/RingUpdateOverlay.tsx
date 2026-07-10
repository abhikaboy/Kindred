import React, { useEffect, useRef, useState } from "react";
import {
    Animated,
    Dimensions,
    Easing,
    StyleSheet,
    View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";
import Confetti from "@/components/ui/Confetti";
import * as Haptics from "expo-haptics";
import { Check } from "phosphor-react-native";
import { ThemedText } from "@/components/ThemedText";
import { useRingUpdate } from "@/contexts/ringUpdateContext";
import { useTimeouts } from "@/hooks/useTimeouts";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } =
    Dimensions.get("screen");
const GRADIENT_HEIGHT = SCREEN_HEIGHT * 0.38;
const RING_SIZE = 88;
const STROKE_WIDTH = 7;
const RADIUS = (RING_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const PRIMARY_COLOR = "#854DFF";
const TRACK_COLOR = "rgba(255,255,255,0.18)";

const RING_LABELS: Record<"plan" | "do" | "share", string> = {
    plan: "Plan",
    do: "Do",
    share: "Share",
};

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Phased timings — let each beat breathe.
//   0ms .. 1000ms  : gradient slowly fades in (the room dims)
//   1000ms .. 1500ms : ring slides in from above + fades in
//   1700ms .. 2500ms : arc animates previous → current
//   then hold, then exit (ring leaves first, gradient lingers)
const GRADIENT_ENTER_DURATION = 1000;
const RING_ENTER_DELAY = 1000;
const RING_ENTER_DURATION = 520;
const ARC_DELAY = 1700;
const ARC_DURATION = 800;
const ENTER_TOTAL = ARC_DELAY + ARC_DURATION; // 2500
const HOLD_NORMAL = 500;
const HOLD_CLOSE = 1600;
const RING_EXIT_DURATION = 480;
const GRADIENT_EXIT_DELAY = 220;
const GRADIENT_EXIT_DURATION = 720;
const EXIT_TOTAL = GRADIENT_EXIT_DELAY + GRADIENT_EXIT_DURATION;
// Fire heavy haptic + confetti slightly before the arc snaps home so the
// haptic feels like it _caused_ the ring to close.
const CLOSE_FX_DELAY = ENTER_TOTAL - 120;

export const RingUpdateOverlay: React.FC = () => {
    const { currentDelta, onAnimationComplete } = useRingUpdate();
    const insets = useSafeAreaInsets();
    const setT = useTimeouts();

    const gradientOpacity = useRef(new Animated.Value(0)).current;
    const ringOpacity = useRef(new Animated.Value(0)).current;
    const ringTranslateY = useRef(new Animated.Value(-32)).current;
    const arcAnim = useRef(new Animated.Value(0)).current;
    const checkOpacity = useRef(new Animated.Value(0)).current;
    const countOpacity = useRef(new Animated.Value(1)).current;
    const celebrationOpacity = useRef(new Animated.Value(0)).current;
    const celebrationTranslateY = useRef(new Animated.Value(8)).current;

    const [showConfetti, setShowConfetti] = useState(false);
    const [mounted, setMounted] = useState(false);
    const closeFxTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (!currentDelta) return;

        setMounted(true);
        setShowConfetti(false);

        gradientOpacity.setValue(0);
        ringOpacity.setValue(0);
        ringTranslateY.setValue(-56);
        arcAnim.setValue(0);
        checkOpacity.setValue(0);
        countOpacity.setValue(1);
        celebrationOpacity.setValue(0);
        celebrationTranslateY.setValue(8);

        const isClose = currentDelta.just_closed;
        const isCloseAll = currentDelta.just_closed_all;

        // Enter phase — gradient sweeps in alone, then ring drops in,
        // then the arc animates. Each animation has its own delay so
        // they layer cleanly inside a single parallel.
        const enter = Animated.parallel([
            Animated.timing(gradientOpacity, {
                toValue: 1,
                duration: GRADIENT_ENTER_DURATION,
                easing: Easing.out(Easing.ease),
                useNativeDriver: true,
            }),
            Animated.timing(ringOpacity, {
                toValue: 1,
                delay: RING_ENTER_DELAY,
                duration: RING_ENTER_DURATION,
                easing: Easing.out(Easing.ease),
                useNativeDriver: true,
            }),
            Animated.timing(ringTranslateY, {
                toValue: 0,
                delay: RING_ENTER_DELAY,
                duration: RING_ENTER_DURATION + 60,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }),
            Animated.timing(arcAnim, {
                toValue: 1,
                delay: ARC_DELAY,
                duration: ARC_DURATION,
                easing: Easing.inOut(Easing.cubic),
                useNativeDriver: false,
            }),
        ]);

        const hold = Animated.delay(isClose ? HOLD_CLOSE : HOLD_NORMAL);

        // Exit phase — ring leaves first, gradient lingers a beat and then fades.
        const exit = Animated.parallel([
            Animated.timing(ringOpacity, {
                toValue: 0,
                duration: RING_EXIT_DURATION,
                easing: Easing.in(Easing.ease),
                useNativeDriver: true,
            }),
            Animated.timing(ringTranslateY, {
                toValue: -56,
                duration: RING_EXIT_DURATION,
                easing: Easing.in(Easing.cubic),
                useNativeDriver: true,
            }),
            Animated.timing(celebrationOpacity, {
                toValue: 0,
                duration: RING_EXIT_DURATION,
                useNativeDriver: true,
            }),
            Animated.timing(gradientOpacity, {
                toValue: 0,
                delay: GRADIENT_EXIT_DELAY,
                duration: GRADIENT_EXIT_DURATION,
                easing: Easing.in(Easing.ease),
                useNativeDriver: true,
            }),
        ]);

        const sequence = Animated.sequence([enter, hold, exit]);
        sequence.start(({ finished }) => {
            if (closeFxTimer.current) {
                clearTimeout(closeFxTimer.current);
                closeFxTimer.current = null;
            }
            setMounted(false);
            setShowConfetti(false);
            if (finished) onAnimationComplete();
        });

        if (isClose) {
            closeFxTimer.current = setTimeout(() => {
                Haptics.impactAsync(
                    isCloseAll
                        ? Haptics.ImpactFeedbackStyle.Heavy
                        : Haptics.ImpactFeedbackStyle.Heavy
                ).catch(() => {});
                if (isCloseAll) {
                    setT(() => {
                        Haptics.notificationAsync(
                            Haptics.NotificationFeedbackType.Success
                        ).catch(() => {});
                    }, 140);
                }
                setShowConfetti(true);
                Animated.parallel([
                    Animated.timing(countOpacity, {
                        toValue: 0,
                        duration: 180,
                        useNativeDriver: true,
                    }),
                    Animated.timing(checkOpacity, {
                        toValue: 1,
                        duration: 220,
                        useNativeDriver: true,
                    }),
                    Animated.timing(celebrationOpacity, {
                        toValue: 1,
                        duration: 320,
                        useNativeDriver: true,
                    }),
                    Animated.timing(celebrationTranslateY, {
                        toValue: 0,
                        duration: 320,
                        easing: Easing.out(Easing.cubic),
                        useNativeDriver: true,
                    }),
                ]).start();
            }, CLOSE_FX_DELAY);
        }

        return () => {
            sequence.stop();
            if (closeFxTimer.current) {
                clearTimeout(closeFxTimer.current);
                closeFxTimer.current = null;
            }
        };
    }, [currentDelta]);

    if (!mounted || !currentDelta) return null;

    const targetSafe = currentDelta.target > 0 ? currentDelta.target : 1;
    const previousFraction = Math.min(
        Math.max(currentDelta.previous, 0) / targetSafe,
        1
    );
    const currentFraction = Math.min(
        Math.max(currentDelta.current, 0) / targetSafe,
        1
    );

    const strokeDashoffset = arcAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [
            CIRCUMFERENCE * (1 - previousFraction),
            CIRCUMFERENCE * (1 - currentFraction),
        ],
    });

    const label = RING_LABELS[currentDelta.ring] ?? currentDelta.ring;
    const celebrationText = currentDelta.just_closed_all
        ? "All rings closed!"
        : `${label} ring closed!`;

    return (
        <View style={styles.root} pointerEvents="none">
            <Animated.View
                style={[styles.gradientWrapper, { opacity: gradientOpacity }]}
            >
                <LinearGradient
                    colors={[
                        "rgba(0,0,0,0.92)",
                        "rgba(0,0,0,0.78)",
                        "rgba(0,0,0,0.28)",
                        "transparent",
                    ]}
                    locations={[0, 0.38, 0.72, 1]}
                    style={StyleSheet.absoluteFill}
                />
            </Animated.View>

            <Animated.View
                style={[
                    styles.content,
                    {
                        top: insets.top + 36,
                        opacity: ringOpacity,
                        transform: [{ translateY: ringTranslateY }],
                    },
                ]}
            >
                <ThemedText style={styles.label}>
                    {label.toUpperCase()}
                </ThemedText>
                <View style={styles.ringWrapper}>
                    <Svg width={RING_SIZE} height={RING_SIZE}>
                        <Circle
                            cx={RING_SIZE / 2}
                            cy={RING_SIZE / 2}
                            r={RADIUS}
                            stroke={TRACK_COLOR}
                            strokeWidth={STROKE_WIDTH}
                            fill="none"
                        />
                        <AnimatedCircle
                            cx={RING_SIZE / 2}
                            cy={RING_SIZE / 2}
                            r={RADIUS}
                            stroke={PRIMARY_COLOR}
                            strokeWidth={STROKE_WIDTH}
                            fill="none"
                            strokeDasharray={`${CIRCUMFERENCE}`}
                            strokeDashoffset={strokeDashoffset}
                            strokeLinecap="round"
                            rotation={-90}
                            origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
                        />
                    </Svg>
                    <Animated.View
                        style={[styles.ringCenter, { opacity: countOpacity }]}
                    >
                        <ThemedText style={styles.ringCount}>
                            {currentDelta.current}/{currentDelta.target}
                        </ThemedText>
                    </Animated.View>
                    <Animated.View
                        style={[styles.ringCenter, { opacity: checkOpacity }]}
                    >
                        <Check size={30} color={PRIMARY_COLOR} weight="bold" />
                    </Animated.View>
                </View>
                {currentDelta.just_closed && (
                    <Animated.View
                        style={{
                            opacity: celebrationOpacity,
                            transform: [{ translateY: celebrationTranslateY }],
                        }}
                    >
                        <ThemedText style={styles.celebrationText}>
                            {celebrationText}
                        </ThemedText>
                    </Animated.View>
                )}
            </Animated.View>

            {showConfetti && (
                <View
                    style={StyleSheet.absoluteFill}
                    pointerEvents="none"
                >
                    <Confetti autoStart />
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    root: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 99999,
        elevation: 99999,
    },
    gradientWrapper: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: GRADIENT_HEIGHT,
    },
    content: {
        position: "absolute",
        left: 0,
        right: 0,
        alignItems: "center",
        gap: 12,
    },
    label: {
        color: "rgba(255,255,255,0.72)",
        fontSize: 11,
        fontFamily: "Outfit",
        letterSpacing: 1.6,
        fontWeight: "600",
    },
    ringWrapper: {
        width: RING_SIZE,
        height: RING_SIZE,
        justifyContent: "center",
        alignItems: "center",
    },
    ringCenter: {
        position: "absolute",
        justifyContent: "center",
        alignItems: "center",
    },
    ringCount: {
        color: "#ffffff",
        fontSize: 15,
        fontFamily: "Outfit",
        fontWeight: "600",
    },
    celebrationText: {
        color: "#ffffff",
        fontSize: 16,
        fontFamily: "Outfit",
        fontWeight: "600",
        letterSpacing: 0.2,
        marginTop: 6,
    },
});

export default RingUpdateOverlay;
