import React, { useState, useCallback, useEffect, useRef } from "react";
import {
    View,
    StyleSheet,
    LayoutAnimation,
    UIManager,
    Platform,
    TouchableOpacity,
    Animated as RNAnimated,
} from "react-native";
import Svg, { Circle } from "react-native-svg";

const AnimatedCircle = RNAnimated.createAnimatedComponent(Circle);
import { Check, LockSimple, Gift } from "phosphor-react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useRings } from "@/hooks/useRings";
import { RingProgress, RingState, RingRewardResponse } from "@/api/types";
import ScoreArc from "./ScoreArc";
import ExpandedRingDetail from "./ExpandedRingDetail";
import EncourageModal from "@/components/modals/EncourageModal";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import RewardUnboxingModal from "@/components/modals/RewardUnboxingModal";
import { showToast } from "@/utils/showToast";

if (
    Platform.OS === "android" &&
    UIManager.setLayoutAnimationEnabledExperimental
) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const RING_SIZE = 80;
const STROKE_WIDTH = 6;
const RADIUS = (RING_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const PRIMARY_COLOR = "#854DFF";

type RingKey = "plan" | "do" | "share";

function RingCircle({
    progress,
    trackColor,
}: {
    progress: RingProgress;
    trackColor: string;
}) {
    const fraction =
        progress.target > 0
            ? Math.min(progress.current / progress.target, 1)
            : 0;
    const animatedValue = useRef(new RNAnimated.Value(0)).current;

    useEffect(() => {
        animatedValue.setValue(0);
        RNAnimated.timing(animatedValue, {
            toValue: fraction,
            duration: 800,
            useNativeDriver: false,
        }).start();
    }, [fraction]);

    const strokeDashoffset = animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [CIRCUMFERENCE, 0],
    });

    return (
        <Svg width={RING_SIZE} height={RING_SIZE}>
            <Circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RADIUS}
                stroke={trackColor}
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
    );
}


interface ProductivityRingsCardProps {
    expanded?: boolean;
    onExpandChange?: (expanded: boolean) => void;
}

const ProductivityRingsCard: React.FC<ProductivityRingsCardProps> = ({
    expanded,
    onExpandChange,
}) => {
    const ThemedColor = useThemeColor();
    const { rings, score, streak, isLoading, history, canClaimReward, allClosed, claimReward, isClaiming } = useRings();
    const [expandedRing, setExpandedRing] = useState<RingKey | null>(null);
    const [showUnboxing, setShowUnboxing] = useState(false);
    const [rewardResult, setRewardResult] = useState<RingRewardResponse | null>(null);

    const handleClaim = async () => {
        try {
            const result = await claimReward();
            if (result.claimed) {
                setRewardResult(result);
                setShowUnboxing(true);
            } else {
                showToast("Reward not available yet.", "warning");
            }
        } catch (error) {
            console.error("Claim reward error:", error);
            showToast("Failed to claim reward. Try again.", "danger");
        }
    };

    // Toast when all rings transition from open to closed (not on initial load)
    const prevAllClosed = useRef<boolean | null>(null);

    useEffect(() => {
        if (prevAllClosed.current !== null && allClosed && !prevAllClosed.current) {
            showToast("All rings closed!", "success");
        }
        prevAllClosed.current = allClosed;
    }, [allClosed]);

    // Sync with parent: when blur overlay is dismissed, clear internal state
    React.useEffect(() => {
        if (expanded === false && expandedRing !== null) {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setExpandedRing(null);
        }
    }, [expanded]);

    const trackColor = ThemedColor.tertiary;

    const handleRingPress = useCallback(
        (key: RingKey) => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            const newExpanded = expandedRing === key ? null : key;
            setExpandedRing(newExpanded);
            onExpandChange?.(newExpanded !== null);
        },
        [expandedRing, onExpandChange]
    );

    if (isLoading || !rings) {
        return null;
    }

    const ringEntries: { key: RingKey; label: string; progress: RingProgress }[] = [
        { key: "plan", label: "Plan", progress: rings.plan },
        { key: "do", label: "Do", progress: rings.do },
        { key: "share", label: "Share", progress: rings.share },
    ];

    const isExpanded = expandedRing !== null;

    return (
        <View
            style={[
                styles.card,
                {
                    backgroundColor: ThemedColor.lightened,
                },
                isExpanded && styles.cardExpanded,
            ]}
        >
            {/* Score Arc */}
            <View style={styles.arcSection}>
                <ScoreArc score={score} />
                <View style={styles.privateRow}>
                    <LockSimple size={12} color={ThemedColor.caption} />
                    <ThemedText style={[styles.privateText, { color: ThemedColor.caption }]}>
                        Only visible to you
                    </ThemedText>
                </View>
            </View>

            {/* Rings Row */}
            <View style={styles.ringsRow}>
                {ringEntries.map(({ key, label, progress }) => (
                    <TouchableOpacity
                        key={key}
                        style={[
                            styles.ringItem,
                            isExpanded &&
                                expandedRing !== key && { opacity: 0.3 },
                        ]}
                        onPress={() => handleRingPress(key)}
                        activeOpacity={0.7}
                    >
                        <View style={styles.ringWrapper}>
                            <RingCircle
                                progress={progress}
                                trackColor={trackColor}
                            />
                            <View style={styles.ringCenter}>
                                {progress.closed ? (
                                    <Check
                                        size={24}
                                        color={PRIMARY_COLOR}
                                        weight="bold"
                                    />
                                ) : (
                                    <ThemedText
                                        style={[
                                            styles.ringText,
                                            { color: ThemedColor.text },
                                        ]}
                                    >
                                        {progress.current}/{progress.target}
                                    </ThemedText>
                                )}
                            </View>
                        </View>
                        <ThemedText
                            style={[
                                styles.ringLabel,
                                { color: ThemedColor.caption },
                            ]}
                        >
                            {label.toUpperCase()}
                        </ThemedText>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Expanded detail */}
            {expandedRing && (
                <ExpandedRingDetail
                    ringKey={expandedRing}
                    todayRing={rings[expandedRing]}
                    history={history}
                />
            )}

            {/* Claim reward button */}
            {canClaimReward && !expandedRing && (
                <TouchableOpacity
                    onPress={handleClaim}
                    disabled={isClaiming}
                    activeOpacity={0.8}
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        paddingVertical: 14,
                        borderRadius: 14,
                        borderWidth: 1.5,
                        borderColor: ThemedColor.primary,
                        backgroundColor: ThemedColor.primary + "10",
                        opacity: isClaiming ? 0.6 : 1,
                    }}
                >
                    <Gift size={20} color={ThemedColor.primary} weight="fill" />
                    <ThemedText style={{ color: ThemedColor.primary, fontWeight: "600", fontSize: 15, fontFamily: "Outfit" }}>
                        {isClaiming ? "Claiming..." : "Claim Reward"}
                    </ThemedText>
                </TouchableOpacity>
            )}

            {/* Unboxing modal */}
            <RewardUnboxingModal
                visible={showUnboxing}
                setVisible={setShowUnboxing}
                rewardType={rewardResult?.credit_type ?? "naturalLanguage"}
                rewardAmount={rewardResult?.amount ?? 1}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        borderRadius: 16,
        padding: 20,
        gap: 20,
        shadowColor: "#000",
        shadowOpacity: 0.08,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 12,
        elevation: 3,
    },
    cardExpanded: {
        zIndex: 999,
    },
    arcSection: {
        alignItems: "center",
        gap: 4,
    },
    privateRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
    },
    privateText: {
        fontSize: 11,
        fontFamily: "Outfit",
    },
    ringsRow: {
        flexDirection: "row",
        justifyContent: "space-between",
    },
    ringItem: {
        alignItems: "center",
        gap: 6,
    },
    ringWrapper: {
        width: 80,
        height: 80,
        justifyContent: "center",
        alignItems: "center",
    },
    ringCenter: {
        position: "absolute",
        justifyContent: "center",
        alignItems: "center",
    },
    ringText: {
        fontSize: 14,
        fontFamily: "Outfit",
        fontWeight: "600",
    },
    ringLabel: {
        fontSize: 11,
        fontFamily: "Outfit",
        letterSpacing: 1,
    },
});

/**
 * Simplified rings-only view for friend profiles.
 * Tapping a ring opens an encourage modal with a ring-specific message.
 */
interface FriendRingsProps {
    ringState: RingState;
    userId: string;
    userHandle?: string;
    userName?: string;
}

const RING_ENCOURAGE_MESSAGES: Record<RingKey, string> = {
    plan: "Plan out your day and close that ring!",
    do: "Finish up those tasks, you're almost there!",
    share: "Post something or send some kudos to close the ring!",
};

const FriendRings: React.FC<FriendRingsProps> = ({ ringState, userId, userHandle, userName }) => {
    const ThemedColor = useThemeColor();
    const trackColor = ThemedColor.tertiary;
    const [showEncourageModal, setShowEncourageModal] = useState(false);
    const [selectedRingMessage, setSelectedRingMessage] = useState("");

    const ringEntries: { key: RingKey; label: string; progress: RingProgress }[] = [
        { key: "plan", label: "Plan", progress: ringState.plan },
        { key: "do", label: "Do", progress: ringState.do },
        { key: "share", label: "Share", progress: ringState.share },
    ];

    const handleRingPress = (key: RingKey, progress: RingProgress) => {
        if (progress.closed) return; // No encouragement needed for closed rings
        setSelectedRingMessage(RING_ENCOURAGE_MESSAGES[key]);
        setShowEncourageModal(true);
    };

    return (
        <>
            <View style={styles.ringsRow}>
                {ringEntries.map(({ key, label, progress }) => (
                    <TouchableOpacity
                        key={label}
                        style={styles.ringItem}
                        onPress={() => handleRingPress(key, progress)}
                        activeOpacity={progress.closed ? 1 : 0.7}
                    >
                        <View style={styles.ringWrapper}>
                            <RingCircle progress={progress} trackColor={trackColor} />
                            <View style={styles.ringCenter}>
                                {progress.closed ? (
                                    <Check size={24} color={PRIMARY_COLOR} weight="bold" />
                                ) : (
                                    <ThemedText
                                        style={[styles.ringText, { color: ThemedColor.text }]}
                                    >
                                        {progress.current}/{progress.target}
                                    </ThemedText>
                                )}
                            </View>
                        </View>
                        <ThemedText
                            style={[styles.ringLabel, { color: ThemedColor.caption }]}
                        >
                            {label.toUpperCase()}
                        </ThemedText>
                    </TouchableOpacity>
                ))}
            </View>

            <EncourageModal
                visible={showEncourageModal}
                setVisible={setShowEncourageModal}
                task={undefined}
                encouragementConfig={{
                    userHandle: userHandle || userName || "User",
                    receiverId: userId,
                    categoryName: "",
                }}
                isProfileLevel={true}
                defaultMessage={selectedRingMessage}
            />
        </>
    );
};

export { ProductivityRingsCard, FriendRings };
export default ProductivityRingsCard;
