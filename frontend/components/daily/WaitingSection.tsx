import React, { useEffect, useMemo, useState } from "react";
import { View, ScrollView, TouchableOpacity, StyleSheet, useColorScheme } from "react-native";
import ReanimatedSwipeable, { SwipeDirection } from "react-native-gesture-handler/ReanimatedSwipeable";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { CalendarCheck, CaretDown, CaretUp, Clock } from "phosphor-react-native";
import { ThemedText } from "@/components/ThemedText";
import TaskChip from "@/components/cards/TaskChip";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useTasks } from "@/contexts/tasksContext";
import { updateTaskDeadlineAPI } from "@/api/task";
import { getCategoryDuotoneColors } from "@/utils/categoryColors";
import { getTimeChipInfo } from "@/utils/timeChip";
import { showToast } from "@/utils/showToast";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import { useFirstTouchHint } from "@/hooks/useFirstTouchHint";
import HintBubble from "@/components/ui/HintBubble";
import { ClearFogAction } from "@/components/plan/ClearFogSheet";
import { isInPlan, isPassedPlan } from "@/utils/waitingCandidate";
import { parkedLabel } from "@/utils/planText";
import PassedPlanCard from "@/components/plan/PassedPlanCard";
import PlannedStepCard from "@/components/plan/PlannedStepCard";
import WaitingChip from "@/components/plan/WaitingChip";
import { useWaitingCandidate } from "@/hooks/useWaitingCandidate";
import { isSameDay } from "date-fns";

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

// Long-waiting tasks fade a little instead of turning red: age is a signal, not a verdict
const FADE_AFTER_DAYS = 14;
const daysWaiting = (task: any) => Math.floor((Date.now() - new Date(task.deadline).getTime()) / 86400000);

const WaitingRow = ({ task }: { task: any }) => {
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
                style={[
                    styles.card,
                    { backgroundColor: ThemedColor.lightenedCard },
                    daysWaiting(task) >= FADE_AFTER_DAYS && styles.faded,
                ]}
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
                {chip && <TaskChip label={parkedLabel(chip.label, !!task.parkedAt)} tone="neutral" Icon={Clock} />}
            </TouchableOpacity>
        </ReanimatedSwipeable>
    );
};

/** Today's carry-over: quiet and collapsed by default so waiting never leads the day. */
const WaitingSection = ({ tasks: all }: Props) => {
    const ThemedColor = useThemeColor();
    // Planned tasks show as their step on their day; released ones never show
    const { passed, tasks } = useMemo(() => {
        const live = all.filter((t) => !t.releasedAt && !isInPlan(t));
        return { passed: live.filter((t) => isPassedPlan(t)), tasks: live.filter((t) => !isPassedPlan(t)) };
    }, [all]);
    const [expanded, setExpanded] = useState(passed.length > 0);
    // A plan whose day went by opens the section so its "still want to?" is seen
    useEffect(() => {
        if (passed.length > 0) setExpanded(true);
    }, [passed.length > 0]);
    const { ready: hintReady, done: hintDone } = useFirstTouchHint("waiting_swipe_today");
    const Caret = expanded ? CaretUp : CaretDown;
    if (passed.length === 0 && tasks.length === 0) return null;

    return (
        <View style={styles.section}>
            <TouchableOpacity
                onPress={() => setExpanded((e) => !e)}
                style={styles.header}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={expanded ? "Hide tasks still on your plate" : "Show tasks still on your plate"}
            >
                <ThemedText type="default" style={{ fontSize: 17 }}>
                    Still on your plate
                </ThemedText>
                <View style={{ flex: 1 }} />
                <ClearFogAction />
                <Caret size={14} color={ThemedColor.caption} weight="bold" />
            </TouchableOpacity>
            {expanded && hintReady && <HintBubble text="Swipe right to bring one into today" onDone={hintDone} />}
            {/* Pinned above the grid, so a long list scrolls in place instead of burying the day */}
            {expanded && (
                <ScrollView style={styles.list} contentContainerStyle={styles.listContent} nestedScrollEnabled>
                    {passed.map((t) => (
                        <PassedPlanCard key={t.id} task={t} />
                    ))}
                    {tasks.map((t) => (
                        <WaitingRow key={t.id} task={t} />
                    ))}
                </ScrollView>
            )}
        </View>
    );
};

type HeaderProps = { selectedDate: Date; waiting: any[] };

/** Plans for the viewed day and, on today, the one quiet path chip plus the carry-over. */
export const PlanDayHeader = ({ selectedDate, waiting }: HeaderProps) => {
    const { allTasks } = useTasks();
    const today = isSameDay(selectedDate, new Date());
    const { candidate, several } = useWaitingCandidate(waiting);
    const planned = useMemo(
        () =>
            allTasks.filter(
                (t) => !t.releasedAt && t.plan?.at && isInPlan(t) && isSameDay(new Date(t.plan.at), selectedDate)
            ),
        [allTasks, selectedDate]
    );
    if (!today && planned.length === 0) return null;
    return (
        <View style={styles.planHeader}>
            {today && candidate && (
                <View style={styles.inset}>
                    <WaitingChip task={candidate} several={several} />
                </View>
            )}
            {planned.length > 0 && (
                <View style={[styles.inset, styles.listContent]}>
                    {planned.map((t) => (
                        <PlannedStepCard key={t.id} task={t} />
                    ))}
                </View>
            )}
            {today && <WaitingSection tasks={waiting.filter((t) => !!t.deadline)} />}
        </View>
    );
};

const styles = StyleSheet.create({
    planHeader: {
        gap: 8,
    },
    inset: {
        marginHorizontal: HORIZONTAL_PADDING,
    },
    section: {
        marginHorizontal: HORIZONTAL_PADDING,
        marginBottom: 8,
        paddingVertical: 8,
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
    },
    faded: {
        opacity: 0.7,
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

export default WaitingSection;
