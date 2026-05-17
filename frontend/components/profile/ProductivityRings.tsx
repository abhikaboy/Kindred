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
import { Check } from "phosphor-react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useRings } from "@/hooks/useRings";
import { RingProgress } from "@/api/types";
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

function countClosedRings(
    history: { plan: { closed: boolean }; do: { closed: boolean }; share: { closed: boolean } }[]
): number {
    let count = 0;
    for (const state of history) {
        if (state.plan.closed) count++;
        if (state.do.closed) count++;
        if (state.share.closed) count++;
    }
    return count;
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
    const { rings, score, isLoading, history } = useRings();
    const [expandedRing, setExpandedRing] = useState<RingKey | null>(null);

    // Sync with parent: when blur overlay is dismissed, clear internal state
    React.useEffect(() => {
        if (expanded === false && expandedRing !== null) {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setExpandedRing(null);
        }
    }, [expanded]);

    const trackColor = ThemedColor.tertiary;
    const closedRings = countClosedRings(history);

    // Derive streak from history: consecutive days from most recent where all_closed
    let streak = 0;
    const sortedHistory = [...history].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    for (const state of sortedHistory) {
        if (state.all_closed) {
            streak++;
        } else {
            break;
        }
    }

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
                <View style={styles.pillsRow}>
                    <View style={[styles.pill, { backgroundColor: ThemedColor.tertiary }]}>
                        <ThemedText style={[styles.pillText, { color: ThemedColor.text }]}>
                            Rings: {closedRings}/21
                        </ThemedText>
                    </View>
                    <View style={[styles.pill, { backgroundColor: ThemedColor.tertiary }]}>
                        <ThemedText style={[styles.pillText, { color: ThemedColor.text }]}>
                            Streak: {streak} days
                        </ThemedText>
                    </View>
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
        transform: [{ scale: 1.03 }],
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 6,
        zIndex: 999,
    },
    arcSection: {
        alignItems: "center",
        gap: 8,
    },
    pillsRow: {
        flexDirection: "row",
        gap: 10,
    },
    pill: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    pillText: {
        fontSize: 12,
        fontFamily: "Outfit",
        fontWeight: "500",
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

export { ProductivityRingsCard };
export default ProductivityRingsCard;
