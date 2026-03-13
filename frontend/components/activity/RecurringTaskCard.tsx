import React, { useMemo } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";

interface RecurringTaskCardProps {
    templateId: string;
    taskName: string;
    categoryName: string;
    completionDates: string[];
    year: number;
    month: number;
    isSelected: boolean;
    onToggle: (templateId: string) => void;
    recurType: string;
    recurFrequency?: string;
    streak?: number;
    timesMissed?: number;
    icon?: string;
}

const MISSED_COLOR = "#E5484D";
const MISSED_COLOR_SOFT = "rgba(229, 72, 77, 0.25)";

export const RecurringTaskCard: React.FC<RecurringTaskCardProps> = ({
    templateId,
    taskName,
    categoryName,
    completionDates,
    year,
    month,
    isSelected,
    onToggle,
    streak = 0,
    timesMissed = 0,
}) => {
    const ThemedColor = useThemeColor();

    const { weekActivity, completionsThisMonth } = useMemo(() => {
        const today = new Date();
        const isCurrentMonth = year === today.getFullYear() && month === today.getMonth() + 1;
        const daysInMonth = new Date(year, month, 0).getDate();
        const endDay = isCurrentMonth ? today.getDate() : daysInMonth;
        const startDay = Math.max(1, endDay - 6);

        const activity: ("completed" | "missed" | "none")[] = [];
        for (let day = startDay; day <= endDay; day++) {
            const hasCompletion = completionDates.some(dateStr => {
                const d = new Date(dateStr);
                return d.getFullYear() === year &&
                       d.getMonth() + 1 === month &&
                       d.getDate() === day;
            });
            if (hasCompletion) {
                activity.push("completed");
            } else if (day < (isCurrentMonth ? today.getDate() : daysInMonth + 1)) {
                activity.push("missed");
            } else {
                activity.push("none");
            }
        }

        const monthCount = completionDates.filter(dateStr => {
            const d = new Date(dateStr);
            return d.getFullYear() === year && d.getMonth() + 1 === month;
        }).length;

        return { weekActivity: activity, completionsThisMonth: monthCount };
    }, [completionDates, year, month]);

    const hasMisses = timesMissed > 0;
    const streakBroken = hasMisses && streak === 0;

    return (
        <TouchableOpacity
            style={[
                styles.row,
                {
                    backgroundColor: isSelected
                        ? ThemedColor.lightened
                        : streakBroken
                        ? MISSED_COLOR_SOFT
                        : "transparent",
                },
            ]}
            onPress={() => onToggle(templateId)}
            activeOpacity={0.6}
        >
            <View style={styles.content}>
                <View style={styles.topLine}>
                    <ThemedText
                        type="default"
                        numberOfLines={1}
                        style={[styles.taskName, { color: ThemedColor.text }]}
                    >
                        {taskName}
                    </ThemedText>
                    <View style={styles.trailing}>
                        {streak > 0 ? (
                            <ThemedText type="caption" style={{ fontSize: 12, color: ThemedColor.caption }}>
                                {streak}d streak
                            </ThemedText>
                        ) : hasMisses ? (
                            <ThemedText type="caption" style={{ fontSize: 12, color: MISSED_COLOR }}>
                                {timesMissed} missed
                            </ThemedText>
                        ) : null}
                        <ThemedText
                            type="defaultSemiBold"
                            style={{ color: ThemedColor.primary, fontSize: 13 }}
                        >
                            {completionsThisMonth}/mo
                        </ThemedText>
                    </View>
                </View>
                <View style={styles.bottomLine}>
                    <ThemedText
                        type="caption"
                        numberOfLines={1}
                        style={{ color: ThemedColor.caption, fontSize: 12 }}
                    >
                        {categoryName}
                    </ThemedText>
                    <View style={styles.dotsRow}>
                        {weekActivity.map((status, i) => (
                            <View
                                key={i}
                                style={[
                                    styles.dot,
                                    {
                                        backgroundColor:
                                            status === "completed"
                                                ? ThemedColor.primary
                                                : status === "missed"
                                                ? MISSED_COLOR
                                                : ThemedColor.tertiary,
                                    },
                                ]}
                            />
                        ))}
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    row: {
        paddingVertical: 10,
        paddingHorizontal: 4,
        borderRadius: 8,
    },
    content: {
        gap: 4,
    },
    topLine: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
    },
    taskName: {
        fontSize: 15,
        flex: 1,
    },
    trailing: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    bottomLine: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    dotsRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
});
