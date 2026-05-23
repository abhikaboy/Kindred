import React, { useEffect, useRef, useState } from "react";
import {
    View,
    StyleSheet,
    Modal,
    Dimensions,
    Animated,
    Platform,
} from "react-native";
import {
    Microphone,
    Lightning,
    ChartBar,
    Robot,
    UsersThree,
} from "phosphor-react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import ConfettiCannon from "react-native-confetti-cannon";
import * as Haptics from "expo-haptics";

const CREDIT_TYPES = [
    { key: "voice", label: "Voice Credits", Icon: Microphone },
    { key: "naturalLanguage", label: "AI Credits", Icon: Lightning },
    { key: "analytics", label: "Analytics Credits", Icon: ChartBar },
    { key: "blueprint", label: "Blueprint Credits", Icon: Robot },
    { key: "group", label: "Group Credits", Icon: UsersThree },
] as const;

interface RewardUnboxingModalProps {
    visible: boolean;
    setVisible: (v: boolean) => void;
    rewardType: string;
    rewardAmount: number;
    newTotal?: number;
}

export default function RewardUnboxingModal({
    visible,
    setVisible,
    rewardType,
    rewardAmount,
    newTotal,
}: RewardUnboxingModalProps) {
    const ThemedColor = useThemeColor();
    const confettiRef = useRef<any>(null);
    const [phase, setPhase] = useState<"spinning" | "revealed">("spinning");
    const [leftIndex, setLeftIndex] = useState(0);
    const [centerIndex, setCenterIndex] = useState(1);
    const [rightIndex, setRightIndex] = useState(2);
    const [leftStopped, setLeftStopped] = useState(false);
    const [rightStopped, setRightStopped] = useState(false);
    const [centerStopped, setCenterStopped] = useState(false);

    const centerScale = useRef(new Animated.Value(1)).current;
    const centerGlow = useRef(new Animated.Value(0)).current;
    const rewardOpacity = useRef(new Animated.Value(0)).current;
    const rewardScale = useRef(new Animated.Value(0.5)).current;
    const headerOpacity = useRef(new Animated.Value(0)).current;
    const totalOpacity = useRef(new Animated.Value(0)).current;

    const winningIndex = CREDIT_TYPES.findIndex((c) => c.key === rewardType);
    const safeWinningIndex = winningIndex >= 0 ? winningIndex : 0;

    const haptic = (style: Haptics.ImpactFeedbackStyle) => {
        if (Platform.OS === "ios") Haptics.impactAsync(style);
    };

    useEffect(() => {
        if (!visible) {
            setPhase("spinning");
            setLeftStopped(false);
            setRightStopped(false);
            setCenterStopped(false);
            centerScale.setValue(1);
            centerGlow.setValue(0);
            rewardOpacity.setValue(0);
            rewardScale.setValue(0.5);
            headerOpacity.setValue(0);
            totalOpacity.setValue(0);
            return;
        }

        setPhase("spinning");
        Animated.timing(headerOpacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
        }).start();

        // Loot-box style spin — blazing fast start, exponential deceleration
        const len = CREDIT_TYPES.length;
        let tick = 0;
        let currentInterval = 30; // very fast start
        let spinTimer: ReturnType<typeof setTimeout>;
        let stopped = false;

        const scheduleTick = () => {
            if (stopped) return;
            spinTimer = setTimeout(() => {
                if (stopped) return;
                tick++;
                setLeftIndex(tick % len);
                setCenterIndex((tick + 1) % len);
                setRightIndex((tick + 2) % len);

                // Haptic ratchet — every tick when slow, every 4th when fast
                if (currentInterval > 100 || tick % 4 === 0) {
                    haptic(Haptics.ImpactFeedbackStyle.Light);
                }

                // Exponential deceleration: interval grows by 6% each tick
                // 30ms → ~50ms at tick 20 → ~150ms at tick 50 → ~400ms at tick 80
                currentInterval = Math.min(currentInterval * 1.06, 450);

                scheduleTick();
            }, currentInterval);
        };
        scheduleTick();

        // Left locks first at 2.2s
        const leftTimer = setTimeout(() => {
            const leftLand = (safeWinningIndex + len - 1) % len;
            setLeftIndex(leftLand);
            setLeftStopped(true);
            haptic(Haptics.ImpactFeedbackStyle.Medium);
        }, 2200);

        // Right locks at 3.0s
        const rightTimer = setTimeout(() => {
            const rightLand = (safeWinningIndex + 1) % len;
            setRightIndex(rightLand);
            setRightStopped(true);
            haptic(Haptics.ImpactFeedbackStyle.Medium);
        }, 3000);

        // Center locks last at 3.8s — final reveal
        const centerTimer = setTimeout(() => {
            stopped = true;
            clearTimeout(spinTimer);
            setCenterIndex(safeWinningIndex);
            setCenterStopped(true);

            // Heavy haptic for the landing
            if (Platform.OS === "ios") {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }

            // Dramatic reveal animation
            Animated.parallel([
                Animated.spring(centerScale, {
                    toValue: 1.3,
                    friction: 3,
                    tension: 120,
                    useNativeDriver: true,
                }),
                Animated.timing(centerGlow, {
                    toValue: 1,
                    duration: 500,
                    useNativeDriver: true,
                }),
            ]).start();

            // Reward text appears after a beat
            setTimeout(() => {
                Animated.parallel([
                    Animated.spring(rewardScale, {
                        toValue: 1,
                        friction: 4,
                        tension: 80,
                        useNativeDriver: true,
                    }),
                    Animated.timing(rewardOpacity, {
                        toValue: 1,
                        duration: 400,
                        useNativeDriver: true,
                    }),
                ]).start();

                haptic(Haptics.ImpactFeedbackStyle.Light);
            }, 400);

            // Total text + confetti + done button
            setTimeout(() => {
                Animated.timing(totalOpacity, {
                    toValue: 1,
                    duration: 400,
                    useNativeDriver: true,
                }).start();

                setPhase("revealed");
                confettiRef.current?.start();
            }, 900);
        }, 3800);

        return () => {
            stopped = true;
            clearTimeout(spinTimer);
            clearTimeout(leftTimer);
            clearTimeout(rightTimer);
            clearTimeout(centerTimer);
        };
    }, [visible]);

    const displayLeft = leftStopped
        ? (safeWinningIndex + CREDIT_TYPES.length - 1) % CREDIT_TYPES.length
        : leftIndex;
    const displayCenter = centerStopped ? safeWinningIndex : centerIndex;
    const displayRight = rightStopped
        ? (safeWinningIndex + 1) % CREDIT_TYPES.length
        : rightIndex;

    const LeftIcon = CREDIT_TYPES[displayLeft].Icon;
    const CenterIcon = CREDIT_TYPES[displayCenter].Icon;
    const RightIcon = CREDIT_TYPES[displayRight].Icon;
    const winningType = CREDIT_TYPES[safeWinningIndex];

    const screenWidth = Dimensions.get("window").width;
    const screenHeight = Dimensions.get("window").height;

    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent
            onRequestClose={() => phase === "revealed" && setVisible(false)}
        >
            <View
                style={[
                    styles.overlay,
                    { backgroundColor: ThemedColor.background + "F5" },
                ]}
            >
                <Animated.View style={{ opacity: headerOpacity }}>
                    <ThemedText style={styles.header}>RINGS COMPLETE</ThemedText>
                </Animated.View>

                <View style={styles.slotRow}>
                    <View
                        style={[
                            styles.tile,
                            styles.tileSide,
                            { borderColor: "#854DFF44", backgroundColor: "#854DFF12" },
                        ]}
                    >
                        <LeftIcon size={28} color="#C084FC" weight="fill" />
                    </View>

                    <Animated.View
                        style={[
                            styles.tile,
                            styles.tileCenter,
                            {
                                borderColor: "#854DFF",
                                backgroundColor: "#854DFF22",
                                transform: [{ scale: centerScale }],
                            },
                        ]}
                    >
                        <Animated.View
                            style={[
                                styles.centerGlow,
                                { opacity: centerGlow },
                            ]}
                        />
                        <CenterIcon size={36} color="#fff" weight="fill" />
                    </Animated.View>

                    <View
                        style={[
                            styles.tile,
                            styles.tileSide,
                            { borderColor: "#854DFF44", backgroundColor: "#854DFF12" },
                        ]}
                    >
                        <RightIcon size={28} color="#C084FC" weight="fill" />
                    </View>
                </View>

                <Animated.View
                    style={[
                        styles.rewardSection,
                        {
                            opacity: rewardOpacity,
                            transform: [{ scale: rewardScale }],
                        },
                    ]}
                >
                    <ThemedText style={styles.rewardAmount}>
                        +{rewardAmount}
                    </ThemedText>
                    <ThemedText style={styles.rewardLabel}>
                        {winningType.label}
                    </ThemedText>
                </Animated.View>

                {newTotal != null && (
                    <Animated.View style={[styles.totalBadge, { opacity: totalOpacity }]}>
                        <ThemedText style={styles.totalText}>
                            You now have {newTotal} {winningType.label.toLowerCase()}
                        </ThemedText>
                    </Animated.View>
                )}

                {phase === "revealed" && (
                    <View style={styles.buttonContainer}>
                        <PrimaryButton
                            title="Done"
                            onPress={() => setVisible(false)}
                        />
                    </View>
                )}

                <ConfettiCannon
                    ref={confettiRef}
                    count={120}
                    origin={{ x: screenWidth / 2, y: -screenHeight / 2 }}
                    explosionSpeed={350}
                    fadeOut
                    autoStart={false}
                    fallSpeed={2500}
                    colors={["#854DFF", "#A855F7", "#C084FC", "#E9D5FF", "#FFD700", "#fff"]}
                />
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        gap: 32,
        paddingHorizontal: 32,
    },
    header: {
        fontSize: 13,
        color: "#C084FC",
        textTransform: "uppercase",
        letterSpacing: 2,
        fontWeight: "600",
        fontFamily: "Outfit",
    },
    slotRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    tile: {
        borderRadius: 16,
        borderWidth: 2,
        justifyContent: "center",
        alignItems: "center",
    },
    tileSide: {
        width: 64,
        height: 64,
        borderRadius: 14,
        opacity: 0.4,
    },
    tileCenter: {
        width: 80,
        height: 80,
        overflow: "hidden",
    },
    centerGlow: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "#854DFF",
        opacity: 0.3,
        borderRadius: 14,
    },
    rewardSection: {
        alignItems: "center",
        gap: 2,
    },
    rewardAmount: {
        fontSize: 48,
        fontWeight: "800",
        color: "#fff",
        fontFamily: "Outfit",
        letterSpacing: -1,
    },
    rewardLabel: {
        fontSize: 18,
        color: "#C084FC",
        fontWeight: "600",
        fontFamily: "Outfit",
    },
    totalBadge: {
        backgroundColor: "#854DFF20",
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#854DFF40",
    },
    totalText: {
        fontSize: 15,
        color: "#854DFF",
        fontWeight: "500",
        fontFamily: "Outfit",
    },
    buttonContainer: {
        width: "100%",
        paddingHorizontal: 20,
        marginTop: 16,
    },
});
