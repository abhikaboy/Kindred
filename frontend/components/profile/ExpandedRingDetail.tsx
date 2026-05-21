import React from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useRouter } from "expo-router";
import { RingState } from "@/api/types";

type RingKey = "plan" | "do" | "share";

const PRIMARY_COLOR = "#854DFF";

const RING_LABELS: Record<RingKey, string> = {
    plan: "Plan",
    do: "Do",
    share: "Share",
};

const RING_GUIDANCE: Record<RingKey, string> = {
    plan: "Create or schedule tasks to close this ring",
    do: "Complete tasks to close this ring",
    share: "Post an update or send kudos to close this ring",
};

interface CTA {
    label: string;
    route: string;
}

const RING_CTAS: Record<RingKey, CTA[]> = {
    plan: [
        { label: "Plan Today", route: "/(logged-in)/(tabs)/(task)/daily" },
        { label: "Quick Add", route: "/(logged-in)/(tabs)/(task)/voice" },
    ],
    do: [
        { label: "View Tasks", route: "/(logged-in)/(tabs)/(task)/today" },
    ],
    share: [
        { label: "Make a Post", route: "/(logged-in)/posting/cameraview" },
        { label: "Send Kudos", route: "/(logged-in)/kudos-rewards" },
    ],
};

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

interface ExpandedRingDetailProps {
    ringKey: RingKey;
    todayRing: { current: number; target: number; closed: boolean };
    history: RingState[];
}

const MINI_RING_SIZE = 28;
const MINI_STROKE = 3;
const MINI_RADIUS = (MINI_RING_SIZE - MINI_STROKE) / 2;
const MINI_CIRCUMFERENCE = 2 * Math.PI * MINI_RADIUS;

interface HistoryEntry {
    dayLabel: string;
    closed: boolean;
    fraction: number;
}

function buildHistoryEntries(
    history: RingState[],
    ringKey: RingKey
): HistoryEntry[] {
    const today = new Date();
    const entries: HistoryEntry[] = [];

    for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dayIndex = (date.getDay() + 6) % 7;
        const dateStr = date.toISOString().split("T")[0];

        const state = history.find((h) => {
            const hDate = new Date(h.date).toISOString().split("T")[0];
            return hDate === dateStr;
        });

        const ring = state ? state[ringKey] : null;
        const fraction = ring && ring.target > 0
            ? Math.min(ring.current / ring.target, 1)
            : 0;

        entries.push({
            dayLabel: DAY_LABELS[dayIndex],
            closed: ring ? ring.closed : false,
            fraction,
        });
    }

    return entries;
}

const ExpandedRingDetail: React.FC<ExpandedRingDetailProps> = ({
    ringKey,
    todayRing,
    history,
}) => {
    const ThemedColor = useThemeColor();
    const router = useRouter();
    const entries = buildHistoryEntries(history, ringKey);
    const ctas = RING_CTAS[ringKey];

    return (
        <View style={styles.container}>
            <View style={styles.headerRow}>
                <ThemedText type="subtitle" style={{ color: ThemedColor.text }}>
                    {RING_LABELS[ringKey]} — {todayRing.current} / {todayRing.target}
                </ThemedText>
                {todayRing.closed && (
                    <ThemedText type="caption">Closed!</ThemedText>
                )}
            </View>

            {!todayRing.closed && (
                <ThemedText type="caption">
                    {RING_GUIDANCE[ringKey]}
                </ThemedText>
            )}

            <View style={styles.dotsRow}>
                {entries.map((entry, idx) => {
                    const strokeDashoffset = MINI_CIRCUMFERENCE * (1 - entry.fraction);
                    return (
                        <View key={idx} style={styles.dotColumn}>
                            <Svg width={MINI_RING_SIZE} height={MINI_RING_SIZE}>
                                <Circle
                                    cx={MINI_RING_SIZE / 2}
                                    cy={MINI_RING_SIZE / 2}
                                    r={MINI_RADIUS}
                                    stroke={ThemedColor.tertiary}
                                    strokeWidth={MINI_STROKE}
                                    fill="none"
                                />
                                {entry.fraction > 0 && (
                                    <Circle
                                        cx={MINI_RING_SIZE / 2}
                                        cy={MINI_RING_SIZE / 2}
                                        r={MINI_RADIUS}
                                        stroke={PRIMARY_COLOR}
                                        strokeWidth={MINI_STROKE}
                                        fill="none"
                                        strokeDasharray={`${MINI_CIRCUMFERENCE}`}
                                        strokeDashoffset={strokeDashoffset}
                                        strokeLinecap="round"
                                        rotation={-90}
                                        origin={`${MINI_RING_SIZE / 2}, ${MINI_RING_SIZE / 2}`}
                                    />
                                )}
                            </Svg>
                            <ThemedText
                                style={[styles.dotLabel, { color: ThemedColor.caption }]}
                            >
                                {entry.dayLabel}
                            </ThemedText>
                        </View>
                    );
                })}
            </View>

            <View style={styles.ctaRow}>
                {ctas.map((cta) => (
                    <TouchableOpacity
                        key={cta.label}
                        style={styles.ctaButton}
                        onPress={() => router.push(cta.route as any)}
                        activeOpacity={0.7}
                    >
                        <ThemedText style={styles.ctaText}>{cta.label}</ThemedText>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        gap: 12,
        paddingTop: 16,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: "rgba(128, 128, 128, 0.2)",
    },
    headerRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    dotsRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        paddingHorizontal: 8,
    },
    dotColumn: {
        alignItems: "center",
        gap: 4,
    },
    dotLabel: {
        fontSize: 10,
        fontFamily: "Outfit",
    },
    ctaRow: {
        flexDirection: "row",
        gap: 10,
        marginTop: 4,
    },
    ctaButton: {
        backgroundColor: PRIMARY_COLOR,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 20,
    },
    ctaText: {
        color: "#FFFFFF",
        fontSize: 15,
        fontFamily: "Outfit",
        fontWeight: "500",
    },
});

export default ExpandedRingDetail;
