import React, { useMemo } from "react";
import { View, TouchableOpacity, StyleSheet, useColorScheme } from "react-native";
import { router } from "expo-router";
import { Plus } from "phosphor-react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useTasks } from "@/contexts/tasksContext";
import { format, isSameDay } from "date-fns";
import { isTaskOnDay } from "@/hooks/useDailyTasks";
import { dayKey } from "@/utils/taskCountsByDay";
import { getCategoryDuotoneColors } from "@/utils/categoryColors";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import { DropTarget } from "./dayCells";

type Props = {
    weekStart: Date;
    overdueTasks: any[];
    onAddTask: (date: Date) => void;
    /** Reports each day section's y offset so the planner can open at today. */
    onDayLayout?: (key: string, y: number) => void;
    /** Each day section is a drop target for dragging unscheduled tasks onto it. */
    registerDropTarget: (key: string, target: DropTarget | null) => void;
    hoverKey: string | null;
};

const timeOf = (task: any): Date | null => {
    const t = task.startTime ?? task.deadline;
    if (!t) return null;
    const d = new Date(t);
    return d.getHours() || d.getMinutes() ? d : null;
};

// "9 AM", "12:30 PM": drop :00 so the column stays narrow
const formatTime = (d: Date) =>
    d.toLocaleTimeString("en-US", d.getMinutes() ? { hour: "numeric", minute: "2-digit" } : { hour: "numeric" });

const openTask = (task: any) =>
    router.push({
        pathname: "/(logged-in)/(tabs)/(task)/task/[id]",
        params: { name: task.content, id: task.id, categoryId: task.categoryID || "" },
    });

/** `date` is the agenda day the row sits under; omitted for the overdue carry-over list. */
const Row = ({ task, date }: { task: any; date?: Date }) => {
    const ThemedColor = useThemeColor();
    const scheme = useColorScheme() === "dark" ? "dark" : "light";
    const categoryColor = getCategoryDuotoneColors(task.categoryID, task.categoryName, scheme).dark;
    const time = timeOf(task);
    const overdue = !date;
    const dueHere = !!date && !task.startTime && !!task.deadline && isSameDay(new Date(task.deadline), date);
    // Late only where the deadline actually lands, not on every day a span covers
    const late = (overdue || dueHere || !!task.startTime) && !!task.deadline && new Date(task.deadline) < new Date();

    // Left gutter: the time, the due date for carry-overs, or "All day"
    const gutter = overdue
        ? format(new Date(task.deadline), "MMM d")
        : time
          ? formatTime(time)
          : "All day";
    const status = late ? "Overdue" : dueHere ? "Due" : null;

    // Priority dot matches TaskCard: primary while in progress, else by priority
    const dot = task.workingOnSince
        ? ThemedColor.primary
        : ({ 1: ThemedColor.success, 2: ThemedColor.warning, 3: ThemedColor.error } as Record<number, string>)[
              task.priority
          ];

    return (
        <View style={styles.row}>
            <ThemedText type="caption" numberOfLines={1} style={styles.time}>
                {gutter}
            </ThemedText>
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
                        {status && (
                            <ThemedText type="caption" style={late ? { color: ThemedColor.error } : undefined}>
                                {`${status} · `}
                            </ThemedText>
                        )}
                        {[task.categoryName, task.workspaceName].filter(Boolean).join(" · ")}
                    </ThemedText>
                </View>
                {dot && <View style={[styles.dot, { backgroundColor: dot }]} />}
            </TouchableOpacity>
        </View>
    );
};

const WeekAgenda = ({ weekStart, overdueTasks, onAddTask, onDayLayout, registerDropTarget, hoverKey }: Props) => {
    const ThemedColor = useThemeColor();
    const { allTasks } = useTasks();
    const todayKey = dayKey(new Date());

    const days = useMemo(
        () =>
            Array.from({ length: 7 }, (_, i) => {
                const date = new Date(weekStart);
                date.setDate(weekStart.getDate() + i);
                const tasks = allTasks
                    .filter((t) => isTaskOnDay(t, date))
                    .sort((a, b) => (timeOf(a)?.getTime() ?? Infinity) - (timeOf(b)?.getTime() ?? Infinity));
                return { date, key: dayKey(date), tasks };
            }),
        [allTasks, weekStart]
    );

    // Overdue is relative to now, so it only belongs on the current week, and only for
    // tasks due before it; anything due earlier this week already shows (in red) on its day
    const carryOver = days.some((d) => d.key === todayKey)
        ? overdueTasks.filter((t) => new Date(t.deadline) < weekStart)
        : [];
    const showOverdue = carryOver.length > 0;

    return (
        <View style={styles.wrap}>
            {showOverdue && (
                <View style={styles.day}>
                    <View style={[styles.dayHeader, { borderBottomColor: ThemedColor.tertiary }]}>
                        <ThemedText type="defaultSemiBold" style={{ color: ThemedColor.error }}>
                            Overdue
                        </ThemedText>
                        <ThemedText type="caption">{carryOver.length}</ThemedText>
                    </View>
                    {carryOver.map((t) => (
                        <Row key={t.id} task={t} />
                    ))}
                </View>
            )}

            {days.map(({ date, key, tasks }) => {
                const isToday = key === todayKey;
                const hovered = key === hoverKey;
                const weekday = date.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
                return (
                    <View
                        key={key}
                        ref={(r) => registerDropTarget(key, r)}
                        style={[
                            styles.day,
                            styles.dropZone,
                            hovered && { borderColor: ThemedColor.primary, backgroundColor: ThemedColor.lightened },
                        ]}
                        onLayout={(e) => onDayLayout?.(key, e.nativeEvent.layout.y)}
                    >
                        <View style={[styles.dayHeader, { borderBottomColor: ThemedColor.tertiary }]}>
                            <View style={styles.dayTitle}>
                                <ThemedText
                                    type="defaultSemiBold"
                                    style={isToday ? { color: ThemedColor.primary } : undefined}
                                >
                                    {`${weekday} ${date.getDate()}`}
                                </ThemedText>
                                {isToday && (
                                    <ThemedText type="caption" style={{ color: ThemedColor.primary }}>
                                        Today
                                    </ThemedText>
                                )}
                                {tasks.length === 0 && (
                                    <ThemedText type="caption">Nothing planned</ThemedText>
                                )}
                            </View>
                            <TouchableOpacity
                                onPress={() => onAddTask(date)}
                                hitSlop={10}
                                accessibilityLabel={`Add a task on ${weekday} ${date.getDate()}`}
                            >
                                <Plus size={16} color={ThemedColor.caption} weight="bold" />
                            </TouchableOpacity>
                        </View>
                        {tasks.map((t) => (
                            <Row key={t.id} task={t} date={date} />
                        ))}
                    </View>
                );
            })}
        </View>
    );
};

const styles = StyleSheet.create({
    wrap: {
        paddingHorizontal: HORIZONTAL_PADDING,
        gap: 16,
    },
    day: {
        gap: 8,
    },
    // Reserved border so the dashed drop highlight doesn't shift the layout
    dropZone: {
        margin: -8,
        padding: 8,
        borderRadius: 16,
        borderWidth: 1.5,
        borderStyle: "dashed",
        borderColor: "transparent",
    },
    dayHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingBottom: 4,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    dayTitle: {
        flexDirection: "row",
        alignItems: "baseline",
        gap: 8,
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    time: {
        width: 56,
    },
    card: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingLeft: 12,
        paddingRight: 16,
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
    dot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
});

export default WeekAgenda;
