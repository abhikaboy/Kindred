import React, { useState } from "react";
import { View, ScrollView, TouchableOpacity, StyleSheet, useColorScheme } from "react-native";
import ReanimatedSwipeable, { SwipeDirection } from "react-native-gesture-handler/ReanimatedSwipeable";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { CalendarCheck, CaretDown, CaretUp, Clock, WarningCircle } from "phosphor-react-native";
import { ThemedText } from "@/components/ThemedText";
import TaskChip from "@/components/cards/TaskChip";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useTasks } from "@/contexts/tasksContext";
import { updateTaskDeadlineAPI } from "@/api/task";
import { getCategoryDuotoneColors } from "@/utils/categoryColors";
import { getTimeChipInfo } from "@/utils/timeChip";
import { showToast } from "@/utils/showToast";
import { HORIZONTAL_PADDING } from "@/constants/spacing";

type Props = { tasks: any[] };

const openTask = (task: any) =>
    router.push({
        pathname: "/(logged-in)/(tabs)/(task)/task/[id]",
        params: { name: task.content, id: task.id, categoryId: task.categoryID || "" },
    });

// Same time of day, today
const onToday = (deadline: string) => {
    const d = new Date(deadline);
    const out = new Date();
    out.setHours(d.getHours(), d.getMinutes(), 0, 0);
    return out;
};

const OverdueRow = ({ task }: { task: any }) => {
    const ThemedColor = useThemeColor();
    const { updateTask } = useTasks();
    const scheme = useColorScheme() === "dark" ? "dark" : "light";
    const categoryColor = getCategoryDuotoneColors(task.categoryID, task.categoryName, scheme).dark;
    const chip = getTimeChipInfo(task, true);

    const moveToToday = async () => {
        if (!task.categoryID) return;
        const next = onToday(task.deadline);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        updateTask(task.categoryID, task.id, { deadline: next.toISOString() });
        try {
            await updateTaskDeadlineAPI(task.categoryID, task.id, next);
        } catch (e) {
            updateTask(task.categoryID, task.id, { deadline: task.deadline });
            showToast("Couldn't move task to today", "danger");
        }
    };

    return (
        <ReanimatedSwipeable
            friction={2}
            leftThreshold={80}
            renderLeftActions={() => (
                <View style={[styles.action, { backgroundColor: ThemedColor.primary }]}>
                    <CalendarCheck size={18} color={ThemedColor.buttonText} weight="bold" />
                    <ThemedText type="caption" style={{ color: ThemedColor.buttonText }}>
                        Today
                    </ThemedText>
                </View>
            )}
            onSwipeableOpen={(direction) => {
                // Swiping right reveals the left-side "Today" action
                if (direction === SwipeDirection.RIGHT) moveToToday();
            }}
        >
            <TouchableOpacity
                onPress={() => openTask(task)}
                activeOpacity={0.7}
                style={[styles.card, { backgroundColor: ThemedColor.lightenedCard, borderColor: ThemedColor.tertiary }]}
            >
                <View style={[styles.categoryBar, { backgroundColor: categoryColor }]} />
                <View style={styles.cardText}>
                    <ThemedText type="default" numberOfLines={1}>
                        {task.content}
                    </ThemedText>
                    <ThemedText type="caption" numberOfLines={1}>
                        {[task.categoryName, task.workspaceName].filter(Boolean).join(" · ")}
                    </ThemedText>
                </View>
                {chip && <TaskChip label={chip.label} tone="overdue" Icon={Clock} />}
            </TouchableOpacity>
        </ReanimatedSwipeable>
    );
};

/** Today's carry-over: collapsed to one line by default so it doesn't crowd the timeline. */
const DayOverdueSection = ({ tasks }: Props) => {
    const ThemedColor = useThemeColor();
    const [expanded, setExpanded] = useState(false);
    const Caret = expanded ? CaretUp : CaretDown;

    return (
        <View style={[styles.section, { backgroundColor: ThemedColor.error + "14", borderColor: ThemedColor.error + "33" }]}>
            <TouchableOpacity
                onPress={() => setExpanded((e) => !e)}
                style={styles.header}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={expanded ? "Hide overdue tasks" : "Show overdue tasks"}
            >
                <WarningCircle size={16} color={ThemedColor.error} weight="bold" />
                <ThemedText type="defaultSemiBold" style={{ color: ThemedColor.error }}>
                    Overdue
                </ThemedText>
                <ThemedText type="caption" style={{ color: ThemedColor.error }}>
                    {tasks.length}
                </ThemedText>
                <View style={{ flex: 1 }} />
                {expanded && <ThemedText type="caption">Swipe right to move to today</ThemedText>}
                <Caret size={14} color={ThemedColor.caption} weight="bold" />
            </TouchableOpacity>
            {/* Pinned above the grid, so a long list scrolls in place instead of burying the day */}
            {expanded && (
                <ScrollView style={styles.list} contentContainerStyle={styles.listContent} nestedScrollEnabled>
                    {tasks.map((t) => (
                        <OverdueRow key={t.id} task={t} />
                    ))}
                </ScrollView>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    section: {
        marginHorizontal: HORIZONTAL_PADDING,
        marginBottom: 8,
        borderWidth: 1,
        borderRadius: 16,
        padding: 12,
        gap: 8,
    },
    list: {
        maxHeight: 200,
    },
    listContent: {
        gap: 8,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    card: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingLeft: 12,
        paddingRight: 12,
        paddingVertical: 8,
        borderRadius: 16,
        borderWidth: 1,
    },
    categoryBar: {
        width: 4,
        alignSelf: "stretch",
    },
    cardText: {
        flex: 1,
    },
    action: {
        width: 88,
        marginRight: 8,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
    },
});

export default DayOverdueSection;
