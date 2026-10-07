import React from "react";
import { View, StyleSheet } from "react-native";
import { format } from "date-fns";
import { useThemeColor } from "@/hooks/useThemeColor";
import { ThemedText } from "@/components/ThemedText";
import { AnalyticsAttention, AnalyticsAttentionTask } from "@/api/analytics";
import { WidgetCard } from "./WidgetCard";

export function TasksNeedingAttentionWidget({ attention }: { attention: AnalyticsAttention }) {
    const tasks = attention?.tasks ?? [];
    if (tasks.length === 0) {
        return (
            <WidgetCard title="Tasks needing attention">
                <ThemedText type="caption">Nothing needs attention right now. 🎉</ThemedText>
            </WidgetCard>
        );
    }
    return (
        <WidgetCard title="Tasks needing attention">
            <View style={{ gap: 14 }}>
                {tasks.map((task) => (
                    <AttentionRow key={task.id} task={task} />
                ))}
            </View>
        </WidgetCard>
    );
}

function AttentionRow({ task }: { task: AnalyticsAttentionTask }) {
    const ThemedColor = useThemeColor() as any;
    const styles = stylesheet(ThemedColor);
    const meta = task.deadline ? `Due ${format(new Date(task.deadline), "MMM d")}` : `${task.daysOpen} days open`;
    return (
        <View style={styles.row}>
            <ThemedText type="defaultSemiBold" style={styles.title} numberOfLines={1}>
                {task.title}
            </ThemedText>
            <ThemedText type="caption">
                {task.category} · {meta}
            </ThemedText>
            <View style={styles.reasons}>
                {(task.reasons ?? []).map((reason) => (
                    <View key={reason} style={styles.chip}>
                        <ThemedText type="caption" style={{ color: ThemedColor.warning, fontSize: 11 }}>
                            {reason}
                        </ThemedText>
                    </View>
                ))}
            </View>
        </View>
    );
}

const stylesheet = (ThemedColor: any) =>
    StyleSheet.create({
        row: {
            gap: 4,
        },
        title: {
            fontSize: 15,
        },
        reasons: {
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 6,
            marginTop: 2,
        },
        chip: {
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: ThemedColor.warning + "55",
            backgroundColor: ThemedColor.warning + "1A",
        },
    });
