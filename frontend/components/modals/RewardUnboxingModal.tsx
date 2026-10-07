import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, StyleSheet, Modal, Animated, Easing, Platform, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle } from "react-native-svg";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
import { Microphone, Lightning, ChartBar, Robot, UsersThree, Gift, Check } from "phosphor-react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import Confetti from "@/components/ui/Confetti";
import * as Haptics from "expo-haptics";
import { RING_COLORS } from "@shared/rings";
import { useTimeouts } from "@/hooks/useTimeouts";

const CREDIT_TYPES = [
    { key: "voice", label: "Voice Credits", Icon: Microphone },
    { key: "naturalLanguage", label: "AI Credits", Icon: Lightning },
    { key: "analytics", label: "Analytics Credits", Icon: ChartBar },
    { key: "blueprint", label: "Blueprint Credits", Icon: Robot },
    { key: "group", label: "Group Credits", Icon: UsersThree },
] as const;

// Each tier lights one more ring and washes the screen in that ring's color.
const TIERS = [
    { label: "Common", color: RING_COLORS.do },
    { label: "Rare", color: RING_COLORS.plan },
    { label: "Epic", color: RING_COLORS.share },
] as const;
const RING_STACK = [RING_COLORS.do, RING_COLORS.plan, RING_COLORS.share];

const TAPS = 3;
const SIZE = 200;
const STROKE = 14;
const GAP = 6;

// Mirrors the backend RewardPool rarity. The server already rolled the reward,
// so the taps act out that roll rather than re-rolling it.
function tierForReward(rewardType: string, amount: number): number {
    if (amount >= 2) return 2;
    if (rewardType === "analytics" || rewardType === "blueprint" || rewardType === "group") return 1;
    return 0;
}

// Picks which taps upgrade the tier, landing exactly on finalTier.
function planUpgrades(finalTier: number): boolean[] {
    const slots = Array.from({ length: TAPS }, (_, i) => i).sort(() => Math.random() - 0.5);
    const chosen = new Set(slots.slice(0, finalTier));
    return Array.from({ length: TAPS }, (_, i) => chosen.has(i));
}

interface RewardUnboxingModalProps {
    visible: boolean;
    setVisible: (v: boolean) => void;
    rewardType: string;
    rewardAmount: number;
    newTotal?: number;
}

type Phase = "tapping" | "ready" | "revealed";

export default function RewardUnboxingModal({
    visible,
    setVisible,
    rewardType,
    rewardAmount,
    newTotal,
}: RewardUnboxingModalProps) {
    const ThemedColor = useThemeColor();
    const confettiRef = useRef<any>(null);

    const finalTier = tierForReward(rewardType, rewardAmount);
    const upgrades = useMemo(() => planUpgrades(finalTier), [finalTier, visible]);

    const [phase, setPhase] = useState<Phase>("tapping");
    const [tapsUsed, setTapsUsed] = useState(0);
    const [tier, setTier] = useState(0);
    // Refs mirror the state so back-to-back taps never read a stale render.
    const tapsRef = useRef(0);
    const tierRef = useRef(0);
    const phaseRef = useRef<Phase>("tapping");

    // One wash + ring opacity per tier, crossfaded on the native driver.
    const washes = useRef(TIERS.map((_, i) => new Animated.Value(i === 0 ? 1 : 0))).current;
    // 0..1 sweep of each ring's arc; drives strokeDashoffset, so JS driver.
    const ringLit = useRef(RING_STACK.map(() => new Animated.Value(0))).current;
    const pop = useRef(new Animated.Value(1)).current;
    const nudge = useRef(new Animated.Value(0)).current;
    const breath = useRef(new Animated.Value(0)).current;
    const stageOpacity = useRef(new Animated.Value(1)).current;
    const reveal = useRef(new Animated.Value(0)).current;

    const setT = useTimeouts();
    const { Soft, Light, Medium, Heavy, Rigid } = Haptics.ImpactFeedbackStyle;

    const haptic = (style: Haptics.ImpactFeedbackStyle) => {
        if (Platform.OS === "ios") Haptics.impactAsync(style);
    };
    const success = () => {
        if (Platform.OS === "ios") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    };
    // Plays [delayMs, style] pairs; skipped once the modal closes.
    const hapticPattern = (steps: [number, Haptics.ImpactFeedbackStyle | "success"][]) => {
        steps.forEach(([ms, style]) =>
            setT(() => {
                if (!visibleRef.current) return;
                if (style === "success") success();
                else haptic(style);
            }, ms)
        );
    };
    const visibleRef = useRef(visible);
    visibleRef.current = visible;

    useEffect(() => {
        if (!visible) return;
        setPhase("tapping");
        setTapsUsed(0);
        setTier(0);
        tapsRef.current = 0;
        tierRef.current = 0;
        phaseRef.current = "tapping";
        washes.forEach((v, i) => v.setValue(i === 0 ? 1 : 0));
        ringLit.forEach((v) => v.setValue(0));
        // The Common ring arcs in as the screen opens.
        Animated.timing(ringLit[0], {
            toValue: 1,
            duration: 600,
            delay: 120,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
        }).start();
        pop.setValue(0.6);
        stageOpacity.setValue(1);
        reveal.setValue(0);
        Animated.spring(pop, { toValue: 1, friction: 6, tension: 90, useNativeDriver: true }).start();
        // Rings land, then settle.
        hapticPattern([[0, Medium], [120, Soft]]);

        const ease = Easing.inOut(Easing.sin);
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(breath, { toValue: 1, duration: 1600, easing: ease, useNativeDriver: true }),
                Animated.timing(breath, { toValue: 0, duration: 1600, easing: ease, useNativeDriver: true }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [visible]);

    // Heartbeat on the glow's peak while waiting for the opening tap.
    useEffect(() => {
        if (!visible || phase !== "ready") return;
        const beat = () => hapticPattern([[0, Soft], [140, Soft]]);
        beat();
        const id = setInterval(beat, 1600);
        return () => clearInterval(id);
    }, [visible, phase]);

    const upgradeTo = (next: number) => {
        tierRef.current = next;
        setTier(next);
        // JS-driven (strokeDashoffset), so it must not share a composite with
        // the native-driven animations below.
        Animated.timing(ringLit[next], {
            toValue: 1,
            duration: 420,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
        }).start();
        pop.setValue(1.18);
        Animated.parallel([
            ...washes.map((v, i) => Animated.timing(v, { toValue: i === next ? 1 : 0, duration: 280, useNativeDriver: true })),
            Animated.spring(pop, { toValue: 1, friction: 4, tension: 140, useNativeDriver: true }),
        ]).start();
        // Hit, the new ring snapping on, then a confirming success.
        hapticPattern([[0, Heavy], [70, Rigid], [140, "success"]]);
    };

    const tapFeedback = () => {
        nudge.setValue(0);
        pop.setValue(0.92);
        Animated.parallel([
            Animated.spring(pop, { toValue: 1, friction: 4, tension: 200, useNativeDriver: true }),
            Animated.sequence([
                Animated.timing(nudge, { toValue: 1, duration: 40, useNativeDriver: true }),
                Animated.timing(nudge, { toValue: -1, duration: 60, useNativeDriver: true }),
                Animated.timing(nudge, { toValue: 0, duration: 40, useNativeDriver: true }),
            ]),
        ]).start();
    };

    const open = () => {
        phaseRef.current = "revealed";
        setPhase("revealed");
        // Crescendo into the burst, a success as the reward lands, then
        // light ticks trailing the confetti.
        hapticPattern([
            [0, Soft],
            [50, Light],
            [95, Medium],
            [135, Heavy],
            [170, Rigid],
            [240, "success"],
            [420, Light],
            [560, Soft],
            [700, Soft],
        ]);
        confettiRef.current?.start();
        Animated.parallel([
            Animated.timing(stageOpacity, { toValue: 0, duration: 160, useNativeDriver: true }),
            Animated.spring(reveal, { toValue: 1, friction: 6, tension: 90, useNativeDriver: true }),
        ]).start();
    };

    // Resolve each tap on press-in and never wait on animations, so taps can
    // be spammed; a new tap simply interrupts the previous tap's motion.
    const handlePressIn = () => {
        if (phaseRef.current === "ready") return open();
        if (phaseRef.current !== "tapping") return;

        const index = tapsRef.current;
        tapFeedback();
        if (upgrades[index]) upgradeTo(Math.min(tierRef.current + 1, TIERS.length - 1));
        // Misses still escalate so each tap feels weightier than the last.
        else haptic([Light, Medium, Heavy][Math.min(index, 2)]);

        tapsRef.current = index + 1;
        setTapsUsed(index + 1);
        if (index + 1 >= TAPS) {
            phaseRef.current = "ready";
            setPhase("ready");
        }
    };

    const current = TIERS[tier];
    const winningType = CREDIT_TYPES.find((c) => c.key === rewardType) ?? CREDIT_TYPES[0];
    const RewardIcon = winningType.Icon;

    const rotate = nudge.interpolate({ inputRange: [-1, 1], outputRange: ["-4deg", "4deg"] });
    const glowScale = breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
    const glowOpacity = breath.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.55] });

    const chancesLeft = TAPS - tapsUsed;
    const prompt =
        phase === "ready"
            ? "Tap to open"
            : tapsUsed === 0
              ? "Tap for a chance to upgrade"
              : `${chancesLeft} ${chancesLeft === 1 ? "chance" : "chances"} left`;

    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent
            onRequestClose={() => phase === "revealed" && setVisible(false)}
        >
            <Pressable
                style={[styles.flex, { backgroundColor: ThemedColor.background }]}
                onPressIn={handlePressIn}
                disabled={phase === "revealed"}
            >
                {TIERS.map((t, i) => (
                    <Animated.View key={t.label} pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: washes[i] }]}>
                        <LinearGradient
                            colors={[t.color + "73", t.color + "33", t.color + "0D"]}
                            locations={[0, 0.55, 1]}
                            style={StyleSheet.absoluteFill}
                        />
                    </Animated.View>
                ))}

                <View style={styles.content}>
                    <Animated.View style={[styles.stage, { opacity: stageOpacity }]}>
                        <View style={styles.header}>
                            <ThemedText type="subtitle" style={[styles.body, { color: current.color }]}>Rings complete</ThemedText>
                            <ThemedText type="titleFraunces" style={{ color: current.color }}>
                                {current.label}
                            </ThemedText>
                        </View>

                        <Animated.View style={{ transform: [{ scale: pop }, { rotate }] }}>
                            <View style={styles.rings}>
                                <Animated.View
                                    style={[
                                        styles.glow,
                                        {
                                            backgroundColor: current.color,
                                            shadowColor: current.color,
                                            opacity: glowOpacity,
                                            transform: [{ scale: glowScale }],
                                        },
                                    ]}
                                />
                                {RING_STACK.map((color, i) => {
                                    const r = (SIZE - STROKE) / 2 - i * (STROKE + GAP);
                                    return (
                                        <View key={color} style={StyleSheet.absoluteFill}>
                                            <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
                                                <Circle cx={SIZE / 2} cy={SIZE / 2} r={r} stroke={color + "26"} strokeWidth={STROKE} fill="none" />
                                            </Svg>
                                            <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
                                                {/* Rotated so the arc sweeps clockwise from 12 o'clock */}
                                                <AnimatedCircle
                                                    cx={SIZE / 2}
                                                    cy={SIZE / 2}
                                                    r={r}
                                                    stroke={color}
                                                    strokeWidth={STROKE}
                                                    strokeLinecap="round"
                                                    fill="none"
                                                    strokeDasharray={`${2 * Math.PI * r} ${2 * Math.PI * r}`}
                                                    strokeDashoffset={ringLit[i].interpolate({
                                                        inputRange: [0, 1],
                                                        outputRange: [2 * Math.PI * r, 0],
                                                    })}
                                                    opacity={ringLit[i].interpolate({ inputRange: [0, 0.02], outputRange: [0, 1], extrapolate: "clamp" })}
                                                    transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
                                                />
                                            </Svg>
                                        </View>
                                    );
                                })}
                                <View style={styles.ringCenter}>
                                    <Gift size={36} color={current.color} weight="fill" />
                                </View>
                            </View>
                        </Animated.View>

                        <View style={styles.tapRow}>
                            {Array.from({ length: TAPS }).map((_, i) => {
                                const used = i < tapsUsed;
                                const upgraded = used && upgrades[i];
                                return (
                                    <View
                                        key={i}
                                        style={[
                                            styles.tapDot,
                                            {
                                                backgroundColor: upgraded ? current.color : used ? current.color + "33" : "transparent",
                                                borderColor: i === tapsUsed || upgraded ? current.color : current.color + "66",
                                            },
                                        ]}
                                    >
                                        {used && <Check size={12} weight="bold" color={upgraded ? "#FFFFFF" : current.color} />}
                                    </View>
                                );
                            })}
                        </View>

                        <ThemedText type="subtitle" style={styles.body}>{prompt}</ThemedText>
                    </Animated.View>

                    {phase === "revealed" && (
                        <Animated.View
                            style={[
                                styles.reveal,
                                {
                                    opacity: reveal,
                                    transform: [{ scale: reveal.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }],
                                },
                            ]}
                        >
                            <View style={styles.rewardBody}>
                                <View style={styles.rewardIconWrap}>
                                    <Animated.View
                                        style={[
                                            styles.glow,
                                            {
                                                backgroundColor: current.color,
                                                shadowColor: current.color,
                                                opacity: glowOpacity,
                                                transform: [{ scale: glowScale }],
                                            },
                                        ]}
                                    />
                                    <RewardIcon size={64} color={current.color} weight="fill" />
                                </View>
                                <ThemedText type="titleFraunces">
                                    +{rewardAmount} {winningType.label}
                                </ThemedText>
                                <ThemedText type="subtitle" style={[styles.body, { color: current.color }]}>
                                    {current.label} reward{newTotal != null ? ` · ${newTotal} total` : ""}
                                </ThemedText>
                            </View>
                            <PrimaryButton
                                title="Done"
                                onPress={() => {
                                    haptic(Light);
                                    setVisible(false);
                                }}
                                style={{
                                    shadowColor: ThemedColor.primary,
                                    shadowOffset: { width: 0, height: 6 },
                                    shadowOpacity: 0.3,
                                    shadowRadius: 10,
                                    elevation: 6,
                                }}
                            />
                        </Animated.View>
                    )}
                </View>

                <Confetti ref={confettiRef} autoStart={false} />
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1 },
    body: { fontWeight: "400" },
    content: {
        flex: 1,
        justifyContent: "center",
        paddingHorizontal: 24,
    },
    stage: {
        alignItems: "center",
        gap: 32,
    },
    header: {
        alignItems: "center",
        gap: 4,
    },
    rings: {
        width: SIZE,
        height: SIZE,
        justifyContent: "center",
        alignItems: "center",
    },
    glow: {
        position: "absolute",
        width: SIZE * 0.6,
        height: SIZE * 0.6,
        borderRadius: SIZE,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 48,
    },
    ringCenter: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: "center",
        alignItems: "center",
    },
    tapRow: {
        flexDirection: "row",
        gap: 12,
    },
    tapDot: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    reveal: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: "center",
        paddingHorizontal: 24,
        gap: 24,
    },
    rewardBody: {
        alignItems: "center",
        gap: 4,
    },
    rewardIconWrap: {
        width: 160,
        height: 160,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 8,
    },
});
