import React from "react";
import { View, StyleSheet } from "react-native";
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

function describeArc(startAngle: number, endAngle: number): string {
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    const startX = CENTER_X + RADIUS * Math.cos(startRad);
    const startY = CENTER_Y - RADIUS * Math.sin(startRad);
    const endX = CENTER_X + RADIUS * Math.cos(endRad);
    const endY = CENTER_Y - RADIUS * Math.sin(endRad);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    return `M ${startX} ${startY} A ${RADIUS} ${RADIUS} 0 ${largeArc} 0 ${endX} ${endY}`;
}

interface ScoreArcProps {
    score: number;
    maxScore?: number;
}

const ScoreArc: React.FC<ScoreArcProps> = ({ score, maxScore = 100 }) => {
    const ThemedColor = useThemeColor();
    const fraction = Math.min(Math.max(score / maxScore, 0), 1);

    const trackPath = describeArc(0, 180);
    const fillEndAngle = 180 - fraction * 180;
    const fillPath = fraction > 0 ? describeArc(fillEndAngle, 180) : "";

    const displayScore = score >= 30 ? score : "--";

    return (
        <View style={styles.container}>
            <Svg width={ARC_WIDTH} height={ARC_HEIGHT}>
                <Path
                    d={trackPath}
                    stroke={ThemedColor.tertiary}
                    strokeWidth={STROKE_WIDTH}
                    fill="none"
                    strokeLinecap="round"
                />
                {fillPath !== "" && (
                    <Path
                        d={fillPath}
                        stroke={PRIMARY_COLOR}
                        strokeWidth={STROKE_WIDTH}
                        fill="none"
                        strokeLinecap="round"
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
