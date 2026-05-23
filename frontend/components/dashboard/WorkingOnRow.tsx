import React, { useMemo } from "react";
import { View } from "react-native";
import { useTasks } from "@/contexts/tasksContext";
import SwipableTaskCard from "@/components/cards/SwipableTaskCard";
import { HORIZONTAL_PADDING } from "@/constants/spacing";

const WorkingOnRow: React.FC = () => {
    const { unnestedTasks } = useTasks();

    const workingTask = useMemo(() => {
        return unnestedTasks.find((t) => t.workingOnSince);
    }, [unnestedTasks]);

    if (!workingTask || !workingTask.categoryID) return null;

    return (
        <View style={{ marginHorizontal: HORIZONTAL_PADDING, marginTop: 6, marginBottom: 12 }}>
            <SwipableTaskCard
                redirect={true}
                categoryId={workingTask.categoryID}
                task={workingTask}
            />
        </View>
    );
};

export default WorkingOnRow;
