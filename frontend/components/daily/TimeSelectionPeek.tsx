import React, { useEffect } from "react";
import { View, ScrollView, StyleSheet, TouchableOpacity, useColorScheme } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { Clock, Plus } from "phosphor-react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import { getCategoryDuotoneColors } from "@/utils/categoryColors";
import { formatMinutesToTime, formatOrdinalDate } from "@/utils/timeUtils";
import type { ScheduleTimeRange } from "./CalendarView";

const DISMISS_DISTANCE = 40;

type Props = {
    range: ScheduleTimeRange;
    selectedDate: Date;
    tasks: any[];
    assigningTaskId: string | null;
    onAssign: (task: any) => void;
    onCreateNew: () => void;
    onCancel: () => void;
};

const formatDuration = (minutes: number): string => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}m`;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

type TaskCardProps = { task: any; dimmed: boolean; onPress: (task: any) => void };

const TaskCard = ({ task, dimmed, onPress }: TaskCardProps) => {
    const ThemedColor = useThemeColor();
    const scheme = useColorScheme() === "dark" ? "dark" : "light";
    const colors = getCategoryDuotoneColors(task.categoryID, task.categoryName, scheme);
    const subtitle = [task.categoryName, task.workspaceName].filter(Boolean).join(" · ");

    return (
        <TouchableOpacity
            style={[
                styles.card,
                {
                    borderColor: ThemedColor.tertiary,
                    backgroundColor: ThemedColor.background,
                    opacity: dimmed ? 0.4 : 1,
                },
            ]}
            onPress={() => onPress(task)}
            disabled={dimmed}
            activeOpacity={0.7}
        >
            <View style={[styles.dot, { backgroundColor: colors.dark }]} />
            <View style={styles.cardText}>
                <ThemedText type="smallerDefault" numberOfLines={1}>
                    {task.content}
                </ThemedText>
                {subtitle.length > 0 && (
                    <ThemedText type="caption" numberOfLines={1}>
                        {subtitle}
                    </ThemedText>
                )}
            </View>
        </TouchableOpacity>
    );
};

export const TimeSelectionPeek = ({
    range,
    selectedDate,
    tasks,
    assigningTaskId,
    onAssign,
    onCreateNew,
    onCancel,
}: Props) => {
    const ThemedColor = useThemeColor();
    const translateY = useSharedValue(120);

    useEffect(() => {
        translateY.value = withTiming(0, { duration: 220 });
    }, [translateY]);

    const slideIn = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

    // Vertical-only so the horizontal task scroll keeps working.
    const pan = Gesture.Pan()
        .activeOffsetY(12)
        .failOffsetX([-16, 16])
        .onEnd((e) => {
            if (e.translationY > DISMISS_DISTANCE) runOnJS(onCancel)();
        });

    return (
        <GestureDetector gesture={pan}>
            <Animated.View
                style={[
                    styles.peek,
                    slideIn,
                    { backgroundColor: ThemedColor.lightened, borderTopColor: ThemedColor.tertiary },
                ]}
            >
                <View style={styles.header}>
                    <Clock size={16} color={ThemedColor.primary} weight="bold" />
                    <ThemedText type="defaultSemiBold" style={{ color: ThemedColor.primary }}>
                        {`${formatMinutesToTime(range.startMinutes)} – ${formatMinutesToTime(range.endMinutes)}`}
                    </ThemedText>
                    <ThemedText type="caption" style={{ color: ThemedColor.primary }}>
                        {`· ${formatDuration(range.endMinutes - range.startMinutes)}`}
                    </ThemedText>
                </View>

                <ThemedText type="caption">{`Tap a task to schedule it on ${formatOrdinalDate(selectedDate)}`}</ThemedText>

                {tasks.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cards}>
                        {tasks.map((task) => (
                            <TaskCard
                                key={task.id}
                                task={task}
                                dimmed={assigningTaskId === task.id}
                                onPress={onAssign}
                            />
                        ))}
                    </ScrollView>
                )}

                <TouchableOpacity
                    style={[styles.newTaskRow, { borderColor: ThemedColor.tertiary }]}
                    onPress={onCreateNew}
                    activeOpacity={0.7}
                >
                    <Plus size={16} color={ThemedColor.primary} weight="bold" />
                    <ThemedText type="smallerDefault" style={{ color: ThemedColor.primary }}>
                        New task
                    </ThemedText>
                </TouchableOpacity>
            </Animated.View>
        </GestureDetector>
    );
};

const styles = StyleSheet.create({
    peek: {
        borderTopWidth: StyleSheet.hairlineWidth,
        paddingHorizontal: HORIZONTAL_PADDING,
        paddingTop: 10,
        paddingBottom: 14,
        gap: 8,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    cards: { gap: 8, paddingRight: 24 },
    card: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        borderWidth: 1,
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 10,
        width: 200,
    },
    cardText: { flex: 1 },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    newTaskRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        borderWidth: 1,
        borderRadius: 16,
        paddingVertical: 10,
    },
});

export default TimeSelectionPeek;
