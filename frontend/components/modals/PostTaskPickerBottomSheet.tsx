import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated } from "react-native";
import { router } from "expo-router";
import DefaultModal from "./DefaultModal";
import { PostTaskSelectionView } from "@/components/ui/fab/PostTaskSelectionView";
import { getCompletedTasksAPI } from "@/api/task";
import { useTasks } from "@/contexts/tasksContext";
import type { Task } from "@/api/types";

interface Props {
    visible: boolean;
    setVisible: (visible: boolean) => void;
}

export default function PostTaskPickerBottomSheet({ visible, setVisible }: Props) {
    const { workspaces, unnestedTasks } = useTasks();
    const [completedTasks, setCompletedTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(false);
    const opacity = useRef(new Animated.Value(1)).current;

    const getCategoryName = useCallback(
        (categoryId?: string) => {
            if (!categoryId) return "Unknown Category";
            for (const ws of workspaces) {
                const cat = ws.categories.find((c) => c.id === categoryId);
                if (cat) return cat.name;
            }
            return "Unknown Category";
        },
        [workspaces]
    );

    useEffect(() => {
        if (!visible) return;
        setLoading(true);
        getCompletedTasksAPI(1, 20)
            .then((response) => {
                const enriched = (response.tasks as any[])
                    .filter((task) => !task.posted)
                    .map((task) => ({
                        ...task,
                        categoryName: task.categoryName || getCategoryName(task.categoryID),
                        status: "completed",
                    }));
                setCompletedTasks(enriched as any);
            })
            .catch((error) => {
                console.error("Failed to fetch completed tasks:", error);
                setCompletedTasks([]);
            })
            .finally(() => setLoading(false));
    }, [visible, getCategoryName]);

    // Currently-active tasks are already loaded client-side (same list the
    // "In Progress" home row uses) — no extra fetch needed for these.
    const inProgressTasks = useMemo(
        () =>
            unnestedTasks
                .filter((t) => (t.active || t.workingOnSince) && t.categoryID)
                .map((t) => ({ ...t, status: "in_progress" })),
        [unnestedTasks]
    );

    const tasks = useMemo(() => [...inProgressTasks, ...completedTasks], [inProgressTasks, completedTasks]);

    const handleTaskSelect = useCallback(
        (task: any) => {
            setVisible(false);
            router.push({
                pathname: "/(logged-in)/posting/cameraview",
                params: {
                    taskInfo: JSON.stringify({
                        id: task.id,
                        name: task.content,
                        category: task.categoryID,
                        categoryName: task.categoryName,
                        public: task.public,
                        status: task.status,
                    }),
                },
            });
        },
        [setVisible]
    );

    return (
        <DefaultModal visible={visible} setVisible={setVisible} snapPoints={["70%"]} customPadding>
            <PostTaskSelectionView
                completedTasks={tasks}
                loading={loading}
                opacity={opacity}
                onBackPress={() => setVisible(false)}
                onTaskSelect={handleTaskSelect}
                onLayout={() => {}}
            />
        </DefaultModal>
    );
}
