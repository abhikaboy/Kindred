import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import Reanimated, {
    useSharedValue,
    useAnimatedStyle,
    SharedValue,
} from "react-native-reanimated";
import { Task } from "@/api/types";
import { CategoryRect, categoryAtPoint } from "@/utils/dragHitTest";
import { useTasks } from "@/contexts/tasksContext";
import TaskCard from "@/components/cards/TaskCard";

type DragContextValue = {
    fingerX: SharedValue<number>;
    fingerY: SharedValue<number>;
    hoveredCategoryId: string | null;
    isDragging: boolean;
    setCategoryRect: (rect: CategoryRect) => void;
    removeCategoryRect: (categoryId: string) => void;
    beginDrag: (task: Task, sourceCategoryId: string, startX: number, startY: number) => void;
    updateDrag: (x: number, y: number) => void;
    endDrag: () => void;
    cancelDrag: () => void;
};

const DragContext = createContext<DragContextValue | null>(null);

export const useDrag = () => {
    const ctx = useContext(DragContext);
    if (!ctx) throw new Error("useDrag must be used within DragProvider");
    return ctx;
};

/**
 * Like useDrag but returns null when there is no DragProvider above (e.g. a
 * Category or TaskCard rendered in a view-only / encourage / congratulate
 * context). Lets drag-aware components degrade gracefully instead of throwing.
 */
export const useDragOptional = (): DragContextValue | null => useContext(DragContext);

export const DragProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { moveTask } = useTasks();

    const fingerX = useSharedValue(0);
    const fingerY = useSharedValue(0);

    const rectsRef = useRef<Map<string, CategoryRect>>(new Map());
    const draggingRef = useRef<{ task: Task; sourceCategoryId: string } | null>(null);

    const [isDragging, setIsDragging] = useState(false);
    const [hoveredCategoryId, setHoveredCategoryId] = useState<string | null>(null);
    const [draggedTask, setDraggedTask] = useState<Task | null>(null);

    const setCategoryRect = useCallback((rect: CategoryRect) => {
        rectsRef.current.set(rect.categoryId, rect);
    }, []);

    const removeCategoryRect = useCallback((categoryId: string) => {
        rectsRef.current.delete(categoryId);
    }, []);

    const beginDrag = useCallback((task: Task, sourceCategoryId: string, startX: number, startY: number) => {
        draggingRef.current = { task, sourceCategoryId };
        fingerX.value = startX;
        fingerY.value = startY;
        setDraggedTask(task);
        setIsDragging(true);
    }, [fingerX, fingerY]);

    const updateDrag = useCallback((x: number, y: number) => {
        fingerX.value = x;
        fingerY.value = y;
        const hit = categoryAtPoint(Array.from(rectsRef.current.values()), x, y);
        setHoveredCategoryId((prev) => (prev === hit ? prev : hit));
    }, [fingerX, fingerY]);

    const endDrag = useCallback(() => {
        const dragging = draggingRef.current;
        const target = categoryAtPoint(Array.from(rectsRef.current.values()), fingerX.value, fingerY.value);
        if (dragging && target && target !== dragging.sourceCategoryId) {
            void moveTask(dragging.sourceCategoryId, dragging.task.id, target);
        }
        draggingRef.current = null;
        setDraggedTask(null);
        setHoveredCategoryId(null);
        setIsDragging(false);
    }, [fingerX, fingerY, moveTask]);

    // Clear the lifted/dragging state WITHOUT performing a move (e.g. the user
    // held and released in place, or the drag was cancelled).
    const cancelDrag = useCallback(() => {
        draggingRef.current = null;
        setDraggedTask(null);
        setHoveredCategoryId(null);
        setIsDragging(false);
    }, []);

    const ghostStyle = useAnimatedStyle(() => ({
        position: "absolute",
        left: 0,
        top: 0,
        transform: [{ translateX: fingerX.value - 24 }, { translateY: fingerY.value - 24 }],
        opacity: 0.92,
    }));

    return (
        <DragContext.Provider
            value={{
                fingerX,
                fingerY,
                hoveredCategoryId,
                isDragging,
                setCategoryRect,
                removeCategoryRect,
                beginDrag,
                updateDrag,
                endDrag,
                cancelDrag,
            }}>
            {children}
            {isDragging && draggedTask && (
                <View style={StyleSheet.absoluteFill} pointerEvents="none">
                    <Reanimated.View style={[styles.ghost, ghostStyle]}>
                        <TaskCard
                            content={draggedTask.content}
                            value={draggedTask.value}
                            priority={draggedTask.priority as 0 | 1 | 2 | 3}
                            id={draggedTask.id}
                            categoryId={draggedTask.categoryID ?? ""}
                            task={{ ...draggedTask }}
                        />
                    </Reanimated.View>
                </View>
            )}
        </DragContext.Provider>
    );
};

const styles = StyleSheet.create({
    ghost: {
        width: "90%",
        shadowColor: "#000",
        shadowOpacity: 0.25,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 8,
    },
});
