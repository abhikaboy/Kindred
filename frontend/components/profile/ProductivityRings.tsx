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

const RING_GUIDANCE: Record<RingKey, string> = {
    plan: "Create or schedule tasks to close this ring",
    do: "Complete tasks to close this ring",
    share: "Post an update or send kudos to close this ring",
};

interface ProductivityRingsProps {
    userId?: string;
    compact?: boolean;
}

function RingCircle({
    progress,
    trackColor,
}: {
    progress: RingProgress;
    trackColor: string;
}) {
    const fraction = progress.target > 0
        ? Math.min(progress.current / progress.target, 1)
        : 0;
    const strokeDashoffset = CIRCUMFERENCE * (1 - fraction);

    return (
        <Svg width={RING_SIZE} height={RING_SIZE}>
            {/* Background track */}
            <Circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RADIUS}
                stroke={trackColor}
                strokeWidth={STROKE_WIDTH}
                fill="none"
            />
            {/* Progress arc */}
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

const ProductivityRings: React.FC<ProductivityRingsProps> = ({ compact }) => {
    const ThemedColor = useThemeColor();
    const { rings, score, isLoading } = useRings();
    const [expandedRing, setExpandedRing] = useState<RingKey | null>(null);

    const trackColor = ThemedColor.tertiary;
    const displayScore = score >= 30 ? score : null;

    const handleRingPress = useCallback((key: RingKey) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedRing((prev) => (prev === key ? null : key));
    }, []);

    if (isLoading || !rings) {
        return null;
    }

    const ringEntries: { key: RingKey; label: string; progress: RingProgress }[] = [
        { key: "plan", label: "Plan", progress: rings.plan },
        { key: "do", label: "Do", progress: rings.do },
        { key: "share", label: "Share", progress: rings.share },
    ];

    return (
        <View style={styles.container}>
            {/* Productivity Score */}
            {!compact && (
                <View style={styles.scoreSection}>
                    <ThemedText
                        style={[
                            styles.scoreValue,
                            { color: ThemedColor.text },
                        ]}
                    >
                        {displayScore !== null ? displayScore : "--"}
                    </ThemedText>
                    <ThemedText
                        style={[
                            styles.scoreLabel,
                            { color: ThemedColor.caption },
                        ]}
                    >
                        PRODUCTIVITY SCORE
                    </ThemedText>
                </View>
            )}

            {/* Rings row */}
            <View style={styles.ringsRow}>
                {ringEntries.map(({ key, label, progress }) => (
                    <TouchableOpacity
                        key={key}
                        style={styles.ringItem}
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
                <View style={styles.expandedSection}>
                    {(() => {
                        const entry = ringEntries.find(
                            (e) => e.key === expandedRing
                        )!;
                        const { progress } = entry;
                        return (
                            <>
                                <ThemedText
                                    style={[
                                        styles.expandedProgress,
                                        { color: ThemedColor.text },
                                    ]}
                                >
                                    {progress.current} / {progress.target}
                                </ThemedText>
                                <ThemedText
                                    style={[
                                        styles.expandedGuidance,
                                        progress.closed
                                            ? { color: ThemedColor.success }
                                            : { color: ThemedColor.caption },
                                    ]}
                                >
                                    {progress.closed
                                        ? "Closed!"
                                        : RING_GUIDANCE[expandedRing]}
                                </ThemedText>
                            </>
                        );
                    })()}
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        gap: 16,
    },
    scoreSection: {
        alignItems: "flex-start",
        marginBottom: 4,
    },
    scoreValue: {
        fontSize: 36,
        fontWeight: "600",
        fontFamily: "Fraunces",
    },
    scoreLabel: {
        fontSize: 12,
        fontFamily: "Outfit",
        letterSpacing: 1,
        marginTop: 2,
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
    expandedSection: {
        alignItems: "flex-start",
        gap: 4,
    },
    expandedProgress: {
        fontSize: 14,
        fontFamily: "Outfit",
        fontWeight: "600",
    },
    expandedGuidance: {
        fontSize: 13,
        fontFamily: "Outfit",
    },
});

export default ProductivityRings;
