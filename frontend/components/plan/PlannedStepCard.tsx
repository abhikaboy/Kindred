import React, { useCallback } from "react";
import { View, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { PathIcon as Path, Play } from "phosphor-react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useTasks } from "@/contexts/tasksContext";
import { useTaskCompletion } from "@/hooks/useTaskCompletion";
import { markInProgressAPI, setWorkingAPI, updateChecklistAPI } from "@/api/task";
import { clearTaskPlanAPI, setTaskPlanAPI } from "@/api/plan";
import { ActiveTaskActivityFactory } from "@/widgets/widgetUpdaters";
import { completeStep, moreStepsLabel, planWhenLabel, stepsAfter } from "@/utils/planText";
import { showToast } from "@/utils/showToast";
import { showStepDone } from "@/components/plan/StepDoneCelebration";
import type { Task } from "@/api/types";

type Props = { task: Task };

/** A task in plan reads as its next small step, in the normal task card look. */
const PlannedStepCard = ({ task }: Props) => {
    const ThemedColor = useThemeColor();
    const { updateTask } = useTasks();
    const { markTaskAsCompleted } = useTaskCompletion();
    const plan = task.plan;
    const categoryId = task.categoryID ?? "";
    const started = !!task.workingOnSince;

    const start = useCallback(
        (t: Task = task) => {
            if (!categoryId) return;
            if (Platform.OS === "ios") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            const now = new Date().toISOString();
            ActiveTaskActivityFactory.start({
                taskName: t.content,
                workspaceName: t.workspaceName || "Tasks",
                startTime: now,
                endTime: t.deadline || undefined,
                hasEndTime: !!t.deadline,
                categoryId,
                taskId: t.id,
            });
            updateTask(categoryId, t.id, { workingOnSince: now, active: true });
            setWorkingAPI(categoryId, t.id, true).catch(() => {});
            markInProgressAPI(categoryId, t.id).catch(() => {});
        },
        [task, categoryId, updateTask]
    );

    if (!plan) return null;

    const done = () => {
        if (!categoryId) return;
        const { checklist, finishesTask, next } = completeStep(task.checklist, plan.step, task.content);

        if (finishesTask) {
            markTaskAsCompleted(categoryId, task.id, { id: task.id, content: task.content, value: task.value ?? 0 }, undefined, {
                skipConfetti: true,
            });
        } else {
            updateTask(categoryId, task.id, { checklist, workingOnSince: undefined });
            setWorkingAPI(categoryId, task.id, false).catch(() => {});
            updateChecklistAPI(categoryId, task.id, checklist as any).catch(() => {
                updateTask(categoryId, task.id, { checklist: task.checklist });
                showToast("Couldn't save that step", "info");
            });
        }

        showStepDone({
            taskContent: task.content,
            next,
            onKeepGoing: next
                ? () => {
                      // The next step becomes the plan for right now, already started
                      const at = new Date();
                      updateTask(categoryId, task.id, { plan: { ...plan, step: next, at: at.toISOString() } });
                      setTaskPlanAPI(categoryId, task.id, { step: next, size: plan.size, at }).catch(() => {});
                      start({ ...task, checklist });
                  }
                : undefined,
            onDoneForNow: finishesTask
                ? undefined
                : () => {
                      // Back to calm waiting; the plan had moved it to today, so its age starts fresh
                      updateTask(categoryId, task.id, { plan: null });
                      clearTaskPlanAPI(categoryId, task.id).catch(() => {
                          updateTask(categoryId, task.id, { plan });
                      });
                  },
        });
    };

    const more = moreStepsLabel(stepsAfter(task.checklist, plan.step).length);
    const meta = [task.content, planWhenLabel(new Date(plan.at)), more].filter(Boolean).join(" · ");

    return (
        <TouchableOpacity
            activeOpacity={0.7}
            onPress={() =>
                router.push({
                    pathname: "/(logged-in)/(tabs)/(task)/task/[id]",
                    params: { name: task.content, id: task.id, categoryId },
                })
            }
            style={[styles.card, { backgroundColor: ThemedColor.lightenedCard, borderColor: ThemedColor.tertiary }]}
        >
            <View style={styles.row}>
                <View style={styles.text}>
                    <ThemedText type="default" numberOfLines={2}>
                        {plan.step}
                    </ThemedText>
                    <View style={styles.meta}>
                        <Path size={14} color={ThemedColor.primary} />
                        <ThemedText type="caption" numberOfLines={1} style={{ color: ThemedColor.primary, flex: 1 }}>
                            {meta}
                        </ThemedText>
                    </View>
                </View>
                {started && <View style={[styles.dot, { backgroundColor: ThemedColor.primary }]} />}
            </View>
            <View style={styles.actionRow}>
                {started ? (
                    <View style={styles.meta}>
                        <View style={[styles.smallDot, { backgroundColor: ThemedColor.primary }]} />
                        <ThemedText type="caption" style={{ color: ThemedColor.primary }}>
                            Working on it
                        </ThemedText>
                    </View>
                ) : (
                    <View />
                )}
                <TouchableOpacity
                    onPress={started ? done : () => start()}
                    activeOpacity={0.8}
                    hitSlop={8}
                    accessibilityRole="button"
                    style={[styles.button, { backgroundColor: ThemedColor.primary }]}
                >
                    {!started && <Play size={14} color={ThemedColor.buttonText} weight="fill" />}
                    <ThemedText type="smallerDefault" style={{ color: ThemedColor.buttonText }}>
                        {started ? "Done" : "Start"}
                    </ThemedText>
                </TouchableOpacity>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    // Mirrors TaskCard's container so a plan sits in the list like any task
    card: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 16,
        borderWidth: 1,
        gap: 12,
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    text: {
        flex: 1,
        gap: 4,
    },
    meta: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
    },
    dot: {
        width: 12,
        height: 12,
        borderRadius: 6,
    },
    smallDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 4,
    },
    actionRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    button: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        height: 36,
        paddingHorizontal: 16,
        borderRadius: 12,
    },
});

export default PlannedStepCard;
