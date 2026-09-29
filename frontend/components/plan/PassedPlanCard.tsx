import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useTasks } from "@/contexts/tasksContext";
import { openPlanSheet } from "@/hooks/planSheetStore";
import { releaseTaskAPI, setTaskPlanAPI } from "@/api/plan";
import { isDayFull } from "@/utils/planCapacity";
import { passedPlanCaption, sameTimeTomorrow } from "@/utils/planText";
import { showToast } from "@/utils/showToast";
import type { Task } from "@/api/types";

type Props = { task: Task };

/** A plan whose day went by: a gentle "still want to?", with no tally of how many times. */
const PassedPlanCard = ({ task }: Props) => {
    const ThemedColor = useThemeColor();
    const { allTasks, updateTask, removeFromCategory, addToCategory } = useTasks();
    const plan = task.plan;
    const categoryId = task.categoryID ?? "";
    if (!plan || !categoryId) return null;

    const tryTomorrow = () => {
        Haptics.selectionAsync();
        const at = sameTimeTomorrow(new Date(plan.at));
        if (isDayFull(allTasks, at, task.id)) {
            openPlanSheet({ task, when: "tomorrow" });
            return;
        }
        updateTask(categoryId, task.id, { plan: { ...plan, at: at.toISOString() } });
        showToast("Moved to tomorrow.", "success");
        setTaskPlanAPI(categoryId, task.id, { step: plan.step, size: plan.size, at })
            .then((doc: any) => {
                if (doc?.deadline || doc?.startDate)
                    updateTask(categoryId, task.id, { deadline: doc.deadline, startDate: doc.startDate });
            })
            .catch(() => {
                updateTask(categoryId, task.id, { plan });
                showToast("Couldn't move it just now", "info");
            });
    };

    const letGo = () => {
        Haptics.selectionAsync();
        removeFromCategory(categoryId, task.id);
        showToast("Let go. You can bring it back anytime.", "success");
        releaseTaskAPI(categoryId, task.id).catch(() => {
            addToCategory(categoryId, task);
            showToast("Couldn't let it go just now", "info");
        });
    };

    return (
        <View style={[styles.card, { backgroundColor: ThemedColor.lightenedCard, borderColor: ThemedColor.tertiary }]}>
            <ThemedText type="default" numberOfLines={2}>
                {task.content}
            </ThemedText>
            <ThemedText type="caption" style={{ color: ThemedColor.caption }}>
                {passedPlanCaption(plan)}
            </ThemedText>
            <View style={styles.actions}>
                <TouchableOpacity onPress={tryTomorrow} hitSlop={8} accessibilityRole="button">
                    <ThemedText type="smallerDefault" style={{ color: ThemedColor.primary }}>
                        Try tomorrow
                    </ThemedText>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => openPlanSheet({ task })} hitSlop={8} accessibilityRole="button">
                    <ThemedText type="smallerDefault" style={{ color: ThemedColor.primary }}>
                        Break down this task
                    </ThemedText>
                </TouchableOpacity>
                <View style={{ flex: 1 }} />
                <TouchableOpacity onPress={letGo} hitSlop={8} accessibilityRole="button">
                    <ThemedText type="smallerDefault" style={{ color: ThemedColor.caption }}>
                        Let it go
                    </ThemedText>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 16,
        borderWidth: 1,
        gap: 4,
    },
    actions: {
        flexDirection: "row",
        alignItems: "center",
        gap: 16,
        marginTop: 8,
    },
});

export default PassedPlanCard;
