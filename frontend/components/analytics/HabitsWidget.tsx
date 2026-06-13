import React from "react";
import { View, StyleSheet } from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";
import { ThemedText } from "@/components/ThemedText";
import { AnalyticsHabits, AnalyticsHabitRow } from "@/api/analytics";
import { WidgetCard } from "./WidgetCard";

interface Props {
    habits: AnalyticsHabits;
    onPress?: () => void;
}

export function HabitsWidget({ habits, onPress }: Props) {
    const ThemedColor = useThemeColor() as any;
    const styles = stylesheet(ThemedColor);

    return (
        <WidgetCard
            title="Habits & recurring"
            takeaway={habits.takeaway}
            cta={onPress ? { label: "View habits", onPress } : undefined}>
            {(habits.rows ?? []).length === 0 ? (
                <ThemedText type="caption">No recurring tasks yet.</ThemedText>
            ) : (
                <View style={styles.list}>
                    {(habits.rows ?? []).map((row) => (
                        <HabitRow key={row.templateId} row={row} />
                    ))}
                </View>
            )}
        </WidgetCard>
    );
}

function HabitRow({ row }: { row: AnalyticsHabitRow }) {
    const ThemedColor = useThemeColor() as any;
    const styles = stylesheet(ThemedColor);
    return (
        <View style={styles.row}>
            <View style={styles.rowText}>
                <ThemedText type="defaultSemiBold" style={styles.title}>
                    {row.title}
                </ThemedText>
                <ThemedText type="caption">{row.rhythmLabel}</ThemedText>
            </View>
            <View style={styles.dots}>
                {(row.dots ?? []).map((filled, i) => (
                    <View
                        key={i}
                        style={[
                            styles.dot,
                            { backgroundColor: filled ? ThemedColor.primary : ThemedColor.tertiary },
                        ]}
                    />
                ))}
            </View>
        </View>
    );
}

const stylesheet = (ThemedColor: any) =>
    StyleSheet.create({
        list: {
            gap: 14,
        },
        row: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
        },
        rowText: {
            flexShrink: 1,
            gap: 2,
        },
        title: {
            fontSize: 15,
        },
        dots: {
            flexDirection: "row",
            gap: 5,
            flexWrap: "wrap",
            maxWidth: 140,
            justifyContent: "flex-end",
        },
        dot: {
            width: 10,
            height: 10,
            borderRadius: 5,
        },
    });
