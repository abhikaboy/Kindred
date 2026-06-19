import React from "react";
import { View, StyleSheet } from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";
import { ThemedText } from "@/components/ThemedText";
import { AnalyticsKudosEffect } from "@/api/analytics";
import { WidgetCard } from "./WidgetCard";

function formatHours(h: number): string {
    return h >= 24 ? `${(h / 24).toFixed(1)}d` : `${h}h`;
}

export function KudosEffectWidget({ kudosEffect }: { kudosEffect: AnalyticsKudosEffect }) {
    const ThemedColor = useThemeColor() as any;
    const styles = stylesheet(ThemedColor);

    if (!kudosEffect?.hasComparison) {
        return (
            <WidgetCard title="Kudos effect">
                <ThemedText type="caption">
                    {kudosEffect?.takeaway ?? "Not enough completed tasks yet to compare with vs without Kudos."}
                </ThemedText>
            </WidgetCard>
        );
    }

    const w = kudosEffect.withKudosMedianHours;
    const wo = kudosEffect.withoutKudosMedianHours;
    const max = Math.max(w, wo, 1);

    return (
        <WidgetCard title="Kudos effect" takeaway={kudosEffect.takeaway}>
            <CompareRow label="With Kudos" value={formatHours(w)} ratio={w / max} color={ThemedColor.primary} />
            <CompareRow label="Without" value={formatHours(wo)} ratio={wo / max} color={ThemedColor.tertiary} />
        </WidgetCard>
    );
}

function CompareRow({ label, value, ratio, color }: { label: string; value: string; ratio: number; color: string }) {
    const ThemedColor = useThemeColor() as any;
    const styles = stylesheet(ThemedColor);
    return (
        <View style={styles.row}>
            <ThemedText type="caption" style={styles.label}>
                {label}
            </ThemedText>
            <View style={styles.track}>
                <View style={[styles.fill, { width: `${Math.max(6, ratio * 100)}%`, backgroundColor: color }]} />
            </View>
            <ThemedText type="defaultSemiBold" style={styles.value}>
                {value}
            </ThemedText>
        </View>
    );
}

const stylesheet = (ThemedColor: any) =>
    StyleSheet.create({
        row: {
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            marginBottom: 10,
        },
        label: {
            width: 80,
        },
        track: {
            flex: 1,
            height: 14,
            borderRadius: 7,
            backgroundColor: ThemedColor.lightened,
            overflow: "hidden",
        },
        fill: {
            height: "100%",
            borderRadius: 7,
        },
        value: {
            width: 44,
            textAlign: "right",
        },
    });
