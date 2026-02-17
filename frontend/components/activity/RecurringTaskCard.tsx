import React from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { CheckCircle } from "phosphor-react-native";

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
    recurType,
    recurFrequency,
    streak = 0,
    icon = "📚",
}) => {
    const ThemedColor = useThemeColor();

    // Calculate activity for the week (last 7 days of the month)
    const daysInMonth = new Date(year, month, 0).getDate();
    const weekDays = 7;

    // Get completion status for each day in the week
    const getWeekActivity = () => {
        const activity: boolean[] = [];
        const startDay = Math.max(1, daysInMonth - weekDays + 1);

        for (let day = startDay; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const hasCompletion = completionDates.some(date => {
                const d = new Date(date);
                return d.getFullYear() === year &&
                       d.getMonth() + 1 === month &&
                       d.getDate() === day;
            });
            activity.push(hasCompletion);
        }

        return activity;
    };

    const weekActivity = getWeekActivity();

    // Calculate stats
    const completionsThisMonth = completionDates.filter(dateStr => {
        const date = new Date(dateStr);
        return date.getFullYear() === year && date.getMonth() + 1 === month;
    }).length;

    const getDayLabel = (index: number) => {
        const daysInMonth = new Date(year, month, 0).getDate();
        const startDay = Math.max(1, daysInMonth - weekDays + 1);
        const day = startDay + index;
        return day;
    };

    return (
        <TouchableOpacity
            style={[
                styles.card,
                {
                    backgroundColor: isSelected ? ThemedColor.lightenedCard : ThemedColor.card,
                    borderColor: isSelected ? ThemedColor.primary : ThemedColor.tertiary,
                    borderWidth: isSelected ? 2 : 1,
                },
            ]}
            onPress={() => onToggle(templateId)}
            activeOpacity={0.7}
        >
            <View style={styles.header}>
                <View style={styles.iconContainer}>
                    <View style={[styles.iconCircle, { backgroundColor: ThemedColor.lightened }]}>
                        <CheckCircle size={20} color={ThemedColor.primary} weight="bold" />
                    </View>
                </View>
                <View style={styles.titleContainer}>
                    <ThemedText type="defaultSemiBold" numberOfLines={1} style={styles.taskName}>
                        {taskName}
                    </ThemedText>
                    <View style={styles.metaRow}>
                        <View style={styles.categoryBadge}>
                            <ThemedText type="caption" style={{ color: ThemedColor.caption, fontSize: 11 }}>
                                {categoryName}
                            </ThemedText>
                        </View>
                        {streak > 0 && (
                            <>
                                <View style={styles.separator} />
                                <View style={styles.streakBadge}>
                                    <ThemedText type="caption" style={{ color: ThemedColor.primary, fontSize: 11, fontWeight: "600" }}>
                                        🔥 {streak} day streak
                                    </ThemedText>
                                </View>
                            </>
                        )}
                    </View>
                </View>
                <View style={styles.statsContainer}>
                    <ThemedText type="subtitle" style={{ color: ThemedColor.primary }}>
                        {completionsThisMonth}
                    </ThemedText>
                    <ThemedText type="caption" style={{ color: ThemedColor.caption, fontSize: 11 }}>
                        this month
                    </ThemedText>
                </View>
            </View>

            {/* Activity Week View */}
            <View style={styles.activityContainer}>
                {weekActivity.map((isActive, index) => (
                    <View key={index} style={styles.dayColumn}>
                        <View
                            style={[
                                styles.activityDot,
                                {
                                    backgroundColor: isActive
                                        ? ThemedColor.primary
                                        : ThemedColor.tertiary,
                                    opacity: isActive ? 1 : 0.3,
                                },
                            ]}
                        />
                        <ThemedText
                            type="caption"
                            style={[
                                styles.dayLabel,
                                { color: isActive ? ThemedColor.text : ThemedColor.caption }
                            ]}
                        >
                            {getDayLabel(index)}
                        </ThemedText>
                    </View>
                ))}
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    card: {
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 16,
        gap: 12,
    },
    iconContainer: {
        justifyContent: "center",
        alignItems: "center",
    },
    iconCircle: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: "center",
        alignItems: "center",
    },
    titleContainer: {
        flex: 1,
        gap: 4,
    },
    taskName: {
        fontSize: 15,
    },
    metaRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        flexWrap: "wrap",
    },
    categoryBadge: {
        flexDirection: "row",
        alignItems: "center",
    },
    streakBadge: {
        flexDirection: "row",
        alignItems: "center",
    },
    separator: {
        width: 3,
        height: 3,
        borderRadius: 1.5,
        backgroundColor: "#999",
        opacity: 0.3,
    },
    statsContainer: {
        alignItems: "flex-end",
        gap: 2,
    },
    activityContainer: {
        flexDirection: "row",
        justifyContent: "space-between",
        paddingHorizontal: 4,
    },
    dayColumn: {
        alignItems: "center",
        gap: 6,
    },
    activityDot: {
        width: 32,
        height: 32,
        borderRadius: 8,
    },
    dayLabel: {
        fontSize: 11,
    },
});
