import React, { useState, useCallback } from "react";
import {
    View,
    StyleSheet,
    LayoutAnimation,
    UIManager,
    Platform,
    TouchableOpacity,
} from "react-native";
import Svg, { Circle } from "react-native-svg";
import { Check, LockSimple } from "phosphor-react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useRings } from "@/hooks/useRings";
import { RingProgress, RingState } from "@/api/types";
import ScoreArc from "./ScoreArc";
import ExpandedRingDetail from "./ExpandedRingDetail";

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
    const strokeDashoffset = CIRCUMFERENCE * (1 - fraction);

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
            <Circle
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
    const { rings, score, streak, isLoading, history } = useRings();
    const [expandedRing, setExpandedRing] = useState<RingKey | null>(null);

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
 * No card, no arc gauge, no expand behavior.
 */
interface FriendRingsProps {
    ringState: RingState;
}

const FriendRings: React.FC<FriendRingsProps> = ({ ringState }) => {
    const ThemedColor = useThemeColor();
    const trackColor = ThemedColor.tertiary;

    const ringEntries: { label: string; progress: RingProgress }[] = [
        { label: "Plan", progress: ringState.plan },
        { label: "Do", progress: ringState.do },
        { label: "Share", progress: ringState.share },
    ];

    return (
        <View style={styles.ringsRow}>
            {ringEntries.map(({ label, progress }) => (
                <View key={label} style={styles.ringItem}>
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
                </View>
            ))}
        </View>
    );
};

export { ProductivityRingsCard, FriendRings };
export default ProductivityRingsCard;
