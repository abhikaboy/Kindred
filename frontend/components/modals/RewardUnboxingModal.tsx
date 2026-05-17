import React, { useEffect, useRef, useState } from "react";
import {
    View,
    StyleSheet,
    Modal,
    Dimensions,
    Animated,
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
}

const SPIN_DURATION = 1500;
const DECEL_DURATION = 1000;
const ICON_INTERVAL = 80;
const TOTAL_SPIN_MS = SPIN_DURATION + DECEL_DURATION;

export default function RewardUnboxingModal({
    visible,
    setVisible,
    rewardType,
    rewardAmount,
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
    const headerOpacity = useRef(new Animated.Value(0)).current;

    const winningIndex = CREDIT_TYPES.findIndex((c) => c.key === rewardType);
    const safeWinningIndex = winningIndex >= 0 ? winningIndex : 0;

    useEffect(() => {
        if (!visible) {
            setPhase("spinning");
            setLeftStopped(false);
            setRightStopped(false);
            setCenterStopped(false);
            centerScale.setValue(1);
            centerGlow.setValue(0);
            rewardOpacity.setValue(0);
            headerOpacity.setValue(0);
            return;
        }

        setPhase("spinning");
        Animated.timing(headerOpacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
        }).start();

        const len = CREDIT_TYPES.length;
        let tick = 0;

        const interval = setInterval(() => {
            tick++;
            setLeftIndex(tick % len);
            setCenterIndex((tick + 1) % len);
            setRightIndex((tick + 2) % len);
        }, ICON_INTERVAL);

        const leftTimer = setTimeout(() => {
            const leftLand = (safeWinningIndex + len - 1) % len;
            setLeftIndex(leftLand);
            setLeftStopped(true);
        }, SPIN_DURATION);

        const rightTimer = setTimeout(() => {
            const rightLand = (safeWinningIndex + 1) % len;
            setRightIndex(rightLand);
            setRightStopped(true);
        }, SPIN_DURATION + 400);

        const centerTimer = setTimeout(() => {
            clearInterval(interval);
            setCenterIndex(safeWinningIndex);
            setCenterStopped(true);

            Animated.parallel([
                Animated.spring(centerScale, {
                    toValue: 1.15,
                    friction: 4,
                    tension: 100,
                    useNativeDriver: true,
                }),
                Animated.timing(centerGlow, {
                    toValue: 1,
                    duration: 400,
                    useNativeDriver: true,
                }),
                Animated.timing(rewardOpacity, {
                    toValue: 1,
                    duration: 500,
                    delay: 200,
                    useNativeDriver: true,
                }),
            ]).start(() => {
                setPhase("revealed");
                confettiRef.current?.start();
            });
        }, TOTAL_SPIN_MS);

        return () => {
            clearInterval(interval);
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
                        <CenterIcon size={32} color="#fff" weight="fill" />
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

                <Animated.View style={[styles.rewardSection, { opacity: rewardOpacity }]}>
                    <ThemedText style={styles.rewardAmount}>
                        +{rewardAmount}
                    </ThemedText>
                    <ThemedText style={styles.rewardSubtitle}>
                        {winningType.label}
                    </ThemedText>
                </Animated.View>

                {phase === "revealed" && (
                    <View style={styles.buttonContainer}>
                        <PrimaryButton
                            title="Done"
                            outline
                            onPress={() => setVisible(false)}
                        />
                    </View>
                )}

                <ConfettiCannon
                    ref={confettiRef}
                    count={60}
                    origin={{ x: screenWidth / 2, y: screenHeight * 0.3 }}
                    explosionSpeed={350}
                    fadeOut
                    autoStart={false}
                    fallSpeed={1200}
                    colors={["#854DFF", "#A855F7", "#C084FC", "#E9D5FF", "#fff"]}
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
        width: 72,
        height: 72,
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
        gap: 4,
    },
    rewardAmount: {
        fontSize: 24,
        fontWeight: "700",
        color: "#fff",
        fontFamily: "Outfit",
    },
    rewardSubtitle: {
        fontSize: 13,
        color: "#C084FC",
        fontWeight: "500",
        fontFamily: "Outfit",
    },
    buttonContainer: {
        width: "100%",
        paddingHorizontal: 20,
        marginTop: 16,
    },
});
