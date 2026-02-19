import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import Animated, { useAnimatedStyle, SharedValue } from "react-native-reanimated";
import { router } from "expo-router";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { getCategoryDuotoneColors } from "@/utils/categoryColors";

interface CalendarEventCardProps {
    task: any;
    hourHeightShared: SharedValue<number>;
    durationHours: number;
    minuteOffset: number;
    widthPercent: number;
    leftPercent: number;
    onLongPress: (task: any) => void;
}

// Helper function to format time
const formatTime = (date: Date): string => {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes.toString().padStart(2, '0');
    return `${displayHours}:${displayMinutes} ${ampm}`;
};

const CalendarEventCardComponent: React.FC<CalendarEventCardProps> = ({
    task,
    hourHeightShared,
    durationHours,
    minuteOffset,
    widthPercent,
    leftPercent,
    onLongPress,
}) => {
    const ThemedColor = useThemeColor();

    const taskStyle = useAnimatedStyle(() => {
        const currentHourHeight = hourHeightShared.value;
        const taskHeight = durationHours * currentHourHeight;
        const topOffset = (minuteOffset / 60) * currentHourHeight;
        return {
            height: taskHeight,
            maxHeight: taskHeight,
            overflow: "hidden" as const,
            top: topOffset,
        };
    });

    // Determine if this is a deadline-only task
    const isDeadline = task.deadline && !task.startTime && !task.startDate;

    // Get category colors for duotone effect
    const categoryColors = getCategoryDuotoneColors(task.categoryID, task.categoryName);

    // Calculate time display
    let startTime: Date | null = null;
    let endTime: Date | null = null;

    if (task.startTime && task.deadline) {
        startTime = new Date(task.startTime);
        endTime = new Date(task.deadline);
    } else if (task.startTime) {
        startTime = new Date(task.startTime);
        endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
    } else if (task.startDate && !isDeadline) {
        startTime = new Date(task.startDate);
        if (task.deadline) {
            endTime = new Date(task.deadline);
        }
    }

    const timeDisplay = startTime && endTime
        ? `${formatTime(startTime)} - ${formatTime(endTime)}`
        : startTime
        ? formatTime(startTime)
        : '';

    const containerStyle = {
        position: "absolute" as const,
        width: `${widthPercent}%` as any,
        left: `${leftPercent}%` as any,
    };

    const contentStyle = [
        styles.content,
        isDeadline ? { borderColor: ThemedColor.error, backgroundColor: ThemedColor.error } : {
            backgroundColor: categoryColors.light,
            borderLeftWidth: 6,
            borderLeftColor: categoryColors.dark,
        }
    ];

    return (
        <Animated.View style={[taskStyle, containerStyle]}>
            <TouchableOpacity
                style={styles.touchable}
                activeOpacity={0.7}
                onPress={() => onLongPress(task)}
                onLongPress={() => onLongPress(task)}>
                <View style={contentStyle}>
                    {timeDisplay && (
                        <ThemedText type="caption" style={[
                            styles.timeText,
                            !isDeadline && { color: categoryColors.dark }
                        ]}>
                            {timeDisplay}
                        </ThemedText>
                    )}
                    <ThemedText type="defaultSemiBold" style={[
                        styles.titleText,
                        isDeadline && { color: ThemedColor.background },
                        !isDeadline && { color: categoryColors.dark }
                    ]}>
                        {isDeadline ? `${task.content} [Deadline]` : task.content}
                    </ThemedText>
                    {(task.categoryName || task.workspaceName) && (
                        <ThemedText type="caption" style={[
                            styles.metaText,
                            !isDeadline && { color: categoryColors.dark }
                        ]}>
                            {task.workspaceName && task.categoryName
                                ? `${task.workspaceName} • ${task.categoryName}`
                                : task.categoryName || task.workspaceName
                            }
                        </ThemedText>
                    )}
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
};

// Memoize CalendarEventCard to prevent unnecessary re-renders
export const CalendarEventCard = React.memo(CalendarEventCardComponent, (prevProps, nextProps) => {
    return (
        prevProps.task.id === nextProps.task.id &&
        prevProps.task.content === nextProps.task.content &&
        prevProps.task.deadline === nextProps.task.deadline &&
        prevProps.task.startTime === nextProps.task.startTime &&
        prevProps.task.startDate === nextProps.task.startDate &&
        prevProps.task.categoryID === nextProps.task.categoryID &&
        prevProps.task.categoryName === nextProps.task.categoryName &&
        prevProps.task.workspaceName === nextProps.task.workspaceName &&
        prevProps.durationHours === nextProps.durationHours &&
        prevProps.minuteOffset === nextProps.minuteOffset &&
        prevProps.widthPercent === nextProps.widthPercent &&
        prevProps.leftPercent === nextProps.leftPercent
    );
});

const styles = StyleSheet.create({
    touchable: {
        flex: 1,
        width: "100%",
        height: "100%",
        overflow: "hidden",
    },
    content: {
        height: "100%",
        maxHeight: "100%",
        overflow: "hidden",
        paddingHorizontal: 12,
        paddingVertical: 2,
        borderRadius: 12,
        justifyContent: "center",
    },
    timeText: {
        fontSize: 10,
        fontWeight: '700',
    },
    titleText: {
        fontSize: 14,
    },
    metaText: {
        fontSize: 9,
        opacity: 0.85,
        fontWeight: '500',
    },
});
