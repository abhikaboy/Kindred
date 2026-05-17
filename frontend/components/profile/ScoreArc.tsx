import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated as RNAnimated } from "react-native";
import Svg, { Path } from "react-native-svg";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";

const ARC_WIDTH = 200;
const ARC_HEIGHT = 120;
const STROKE_WIDTH = 10;
const PRIMARY_COLOR = "#854DFF";

const RADIUS = (ARC_WIDTH - STROKE_WIDTH) / 2;
const CENTER_X = ARC_WIDTH / 2;
const CENTER_Y = ARC_HEIGHT - 10;

// Full semi-circle path from left (180°) to right (0°)
function describeFullArc(): string {
    const startX = CENTER_X - RADIUS; // leftmost point (0)
    const startY = CENTER_Y;
    const endX = CENTER_X + RADIUS; // rightmost point (100)
    const endY = CENTER_Y;
    return `M ${startX} ${startY} A ${RADIUS} ${RADIUS} 0 1 1 ${endX} ${endY}`;
}

// Approximate arc length for the semi-circle
const ARC_LENGTH = Math.PI * RADIUS;

const AnimatedPath = RNAnimated.createAnimatedComponent(Path);

interface ScoreArcProps {
    score: number;
    maxScore?: number;
}

const ScoreArc: React.FC<ScoreArcProps> = ({ score, maxScore = 100 }) => {
    const ThemedColor = useThemeColor();
    const fraction = Math.min(Math.max(score / maxScore, 0), 1);
    const animatedValue = useRef(new RNAnimated.Value(0)).current;

    useEffect(() => {
        animatedValue.setValue(0);
        RNAnimated.timing(animatedValue, {
            toValue: fraction,
            duration: 800,
            useNativeDriver: false, // strokeDashoffset not supported by native driver
        }).start();
    }, [fraction]);

    const arcPath = describeFullArc();

    // Animated strokeDashoffset: full length (hidden) → partial (revealed)
    const strokeDashoffset = animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [ARC_LENGTH, 0],
    });

    const displayScore = score >= 30 ? score : "--";

    return (
        <View style={styles.container}>
            <Svg width={ARC_WIDTH} height={ARC_HEIGHT}>
                {/* Background track */}
                <Path
                    d={arcPath}
                    stroke={ThemedColor.tertiary}
                    strokeWidth={STROKE_WIDTH}
                    fill="none"
                    strokeLinecap="round"
                />
                {/* Animated fill */}
                {fraction > 0 && (
                    <AnimatedPath
                        d={arcPath}
                        stroke={PRIMARY_COLOR}
                        strokeWidth={STROKE_WIDTH}
                        fill="none"
                        strokeLinecap="round"
                        strokeDasharray={`${ARC_LENGTH}`}
                        strokeDashoffset={strokeDashoffset}
                    />
                )}
            </Svg>
            <View style={styles.scoreOverlay}>
                <ThemedText style={[styles.scoreValue, { color: ThemedColor.text }]}>
                    {displayScore}
                </ThemedText>
            </View>
            <View style={styles.labelsRow}>
                <ThemedText style={[styles.endLabel, { color: ThemedColor.caption }]}>
                    0
                </ThemedText>
                <ThemedText style={[styles.meterLabel, { color: ThemedColor.caption }]}>
                    PRODUCTIVITY METER
                </ThemedText>
                <ThemedText style={[styles.endLabel, { color: ThemedColor.caption }]}>
                    100
                </ThemedText>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: "center",
        width: ARC_WIDTH,
        height: ARC_HEIGHT + 20,
    },
    scoreOverlay: {
        position: "absolute",
        bottom: 24,
        alignItems: "center",
    },
    scoreValue: {
        fontSize: 36,
        fontWeight: "600",
        fontFamily: "Fraunces",
    },
    labelsRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        width: ARC_WIDTH,
        marginTop: -4,
    },
    endLabel: {
        fontSize: 10,
        fontFamily: "Outfit",
    },
    meterLabel: {
        fontSize: 9,
        fontFamily: "Outfit",
        letterSpacing: 1.2,
        fontWeight: "500",
    },
});

export default ScoreArc;
