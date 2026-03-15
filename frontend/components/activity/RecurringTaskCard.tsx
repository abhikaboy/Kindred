import React, { useMemo, useState } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import CustomAlert, { AlertButton } from "@/components/modals/CustomAlert";
import { resetTemplateMetricsAPI } from "@/api/task";

interface RecurringTaskCardProps {
    templateId: string;
    taskName: string;
    categoryName: string;
    completionDates: string[];
    year: number;
    month: number;
    isSelected: boolean;
    onToggle: (templateId: string) => void;
    onMetricsReset?: (templateId: string) => void;
    recurType: string;
    recurFrequency?: string;
    streak?: number;
    timesCompleted?: number;
    timesMissed?: number;
    icon?: string;
}

export const RecurringTaskCard: React.FC<RecurringTaskCardProps> = ({
    templateId,
    taskName,
    categoryName,
    completionDates,
    year,
    month,
    isSelected,
    onToggle,
    onMetricsReset,
    streak = 0,
    timesCompleted = 0,
    timesMissed = 0,
}) => {
    const ThemedColor = useThemeColor();
    const [alertVisible, setAlertVisible] = useState(false);

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

    const totalAttempts = timesCompleted + timesMissed;
    const completionPct = totalAttempts > 0 ? Math.round((timesCompleted / totalAttempts) * 100) : null;

    const pctColor =
        completionPct === null
            ? ThemedColor.caption
            : completionPct >= 80
            ? ThemedColor.success
            : completionPct >= 50
            ? ThemedColor.warning
            : ThemedColor.error;

    const handleReset = async () => {
        try {
            await resetTemplateMetricsAPI(templateId);
            onMetricsReset?.(templateId);
        } catch (e) {
            console.error("Failed to reset metrics:", e);
        }
    };

    const alertButtons: AlertButton[] = [
        { text: "Cancel", style: "cancel" },
        {
            text: "Reset",
            style: "destructive",
            onPress: handleReset,
        },
    ];

    return (
        <>
            <TouchableOpacity
                style={[
                    styles.row,
                    {
                        backgroundColor: isSelected
                            ? ThemedColor.lightened
                            : "transparent",
                    },
                ]}
                onPress={() => onToggle(templateId)}
                onLongPress={() => setAlertVisible(true)}
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
                            ) : completionPct !== null ? (
                                <ThemedText type="caption" style={{ fontSize: 12, color: pctColor }}>
                                    {completionPct}%
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
                                                    ? ThemedColor.caption
                                                    : ThemedColor.tertiary,
                                        },
                                    ]}
                                />
                            ))}
                        </View>
                    </View>
                </View>
            </TouchableOpacity>
            {alertVisible && (
                <CustomAlert
                    visible={alertVisible}
                    setVisible={setAlertVisible}
                    title="Reset Metrics"
                    message={`Reset streak, completion, and missed counts for "${taskName}"? This cannot be undone.`}
                    buttons={alertButtons}
                />
            )}
        </>
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
