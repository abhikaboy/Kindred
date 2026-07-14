import React, { useMemo } from "react";
import { View } from "react-native";
import { useTasks } from "@/contexts/tasksContext";
import SwipableTaskCard from "@/components/cards/SwipableTaskCard";
import { ThemedText } from "@/components/ThemedText";
import { HORIZONTAL_PADDING } from "@/constants/spacing";

// Home "In Progress" list: every task marked in progress (durable `active`) or
// with a live focus session, so you can see what you're in the middle of.
const WorkingOnRow: React.FC = () => {
    const { unnestedTasks } = useTasks();

    const inProgress = useMemo(
        () => unnestedTasks.filter((t) => (t.active || t.workingOnSince) && t.categoryID),
        [unnestedTasks]
    );

    if (inProgress.length === 0) return null;

    return (
        <View style={{ marginHorizontal: HORIZONTAL_PADDING, marginTop: 6, marginBottom: 12, gap: 8 }}>
            <ThemedText type="subtitle">In Progress</ThemedText>
            {inProgress.map((task) => (
                <SwipableTaskCard key={task.id} redirect={true} categoryId={task.categoryID!} task={task} />
            ))}
        </View>
    );
};

export default WorkingOnRow;
