import React from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
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

function buildHistoryDots(
    history: RingState[],
    ringKey: RingKey
): { dayLabel: string; closed: boolean }[] {
    const today = new Date();
    const dots: { dayLabel: string; closed: boolean }[] = [];

    for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dayIndex = (date.getDay() + 6) % 7;
        const dateStr = date.toISOString().split("T")[0];

        const state = history.find((h) => {
            const hDate = new Date(h.date).toISOString().split("T")[0];
            return hDate === dateStr;
        });

        dots.push({
            dayLabel: DAY_LABELS[dayIndex],
            closed: state ? state[ringKey].closed : false,
        });
    }

    return dots;
}

const ExpandedRingDetail: React.FC<ExpandedRingDetailProps> = ({
    ringKey,
    todayRing,
    history,
}) => {
    const ThemedColor = useThemeColor();
    const router = useRouter();
    const dots = buildHistoryDots(history, ringKey);
    const ctas = RING_CTAS[ringKey];

    return (
        <View style={styles.container}>
            <ThemedText style={[styles.header, { color: ThemedColor.text }]}>
                {RING_LABELS[ringKey]} — {todayRing.current} / {todayRing.target}
            </ThemedText>

            <ThemedText
                style={[
                    styles.guidance,
                    todayRing.closed
                        ? { color: ThemedColor.success }
                        : { color: ThemedColor.caption },
                ]}
            >
                {todayRing.closed ? "Closed!" : RING_GUIDANCE[ringKey]}
            </ThemedText>

            <View style={styles.dotsRow}>
                {dots.map((dot, idx) => (
                    <View key={idx} style={styles.dotColumn}>
                        <View
                            style={[
                                styles.dot,
                                {
                                    backgroundColor: dot.closed
                                        ? PRIMARY_COLOR
                                        : ThemedColor.tertiary,
                                },
                            ]}
                        />
                        <ThemedText
                            style={[styles.dotLabel, { color: ThemedColor.caption }]}
                        >
                            {dot.dayLabel}
                        </ThemedText>
                    </View>
                ))}
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
    header: {
        fontSize: 14,
        fontWeight: "600",
        fontFamily: "Outfit",
    },
    guidance: {
        fontSize: 13,
        fontFamily: "Outfit",
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
    dot: {
        width: 12,
        height: 12,
        borderRadius: 6,
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
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    ctaText: {
        color: "#FFFFFF",
        fontSize: 13,
        fontFamily: "Outfit",
        fontWeight: "600",
    },
});

export default ExpandedRingDetail;
