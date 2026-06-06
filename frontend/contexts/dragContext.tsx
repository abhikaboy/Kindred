import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
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
    setScrollOffset: (y: number) => void;
    beginDrag: (task: Task, sourceCategoryId: string, startX: number, startY: number) => void;
    updateDrag: (x: number, y: number) => void;
    endDrag: () => void;
    cancelDrag: () => void;
};

const DragContext = createContext<DragContextValue | null>(null);

// Flip to false to silence drag hit-test logs. Temporary diagnostics.
const DRAG_DEBUG = true;
const dlog = (...args: unknown[]) => {
    if (DRAG_DEBUG) console.log("[drag]", ...args);
};

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
    const scrollYRef = useRef(0);
    const hoveredRef = useRef<string | null>(null);

    const [isDragging, setIsDragging] = useState(false);
    const [hoveredCategoryId, setHoveredCategoryId] = useState<string | null>(null);
    const [draggedTask, setDraggedTask] = useState<Task | null>(null);

    const setCategoryRect = useCallback((rect: CategoryRect) => {
        // Stamp the scroll offset at measure time so hit-testing can correct
        // for any scrolling that happens before/while a drag is in flight.
        rectsRef.current.set(rect.categoryId, { ...rect, scrollYAtMeasure: scrollYRef.current });
        dlog("rect set", rect.categoryId, `y=${Math.round(rect.y)} h=${Math.round(rect.height)} scrollY=${Math.round(scrollYRef.current)}`, `(total ${rectsRef.current.size})`);
    }, []);

    const removeCategoryRect = useCallback((categoryId: string) => {
        rectsRef.current.delete(categoryId);
    }, []);

    const setScrollOffset = useCallback((y: number) => {
        scrollYRef.current = y;
    }, []);

    // Rects shifted by however far the list has scrolled since each was measured.
    const currentRects = useCallback((): CategoryRect[] =>
        Array.from(rectsRef.current.values()).map((r) => ({
            ...r,
            y: r.y - (scrollYRef.current - (r.scrollYAtMeasure ?? 0)),
        })), []);

    const beginDrag = useCallback((task: Task, sourceCategoryId: string, startX: number, startY: number) => {
        draggingRef.current = { task, sourceCategoryId };
        hoveredRef.current = null;
        fingerX.value = startX;
        fingerY.value = startY;
        setDraggedTask(task);
        setIsDragging(true);
        dlog("lift", `task=${task.id}`, `from=${sourceCategoryId}`, `at=(${Math.round(startX)},${Math.round(startY)})`, `rects=${rectsRef.current.size}`);
    }, [fingerX, fingerY]);

    const updateDrag = useCallback((x: number, y: number) => {
        fingerX.value = x;
        fingerY.value = y;
        const hit = categoryAtPoint(currentRects(), x, y);
        if (hit !== hoveredRef.current) {
            dlog("hover →", hit ?? "(none)", `finger=(${Math.round(x)},${Math.round(y)})`, `scrollY=${Math.round(scrollYRef.current)}`);
            hoveredRef.current = hit;
            setHoveredCategoryId(hit);
            // Light tick when the finger crosses into a new drop zone (not the
            // source it's already in — that would just buzz right after lift).
            if (hit && hit !== draggingRef.current?.sourceCategoryId && Platform.OS === "ios") {
                Haptics.selectionAsync();
            }
        }
    }, [fingerX, fingerY, currentRects]);

    const endDrag = useCallback(() => {
        const dragging = draggingRef.current;
        const target = categoryAtPoint(currentRects(), fingerX.value, fingerY.value);
        dlog("drop", `finger=(${Math.round(fingerX.value)},${Math.round(fingerY.value)})`, `target=${target ?? "(none)"}`, `source=${dragging?.sourceCategoryId ?? "?"}`, `→ ${dragging && target && target !== dragging.sourceCategoryId ? "MOVE" : "no-op"}`);
        if (dragging && target && target !== dragging.sourceCategoryId) {
            if (Platform.OS === "ios") {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
            void moveTask(dragging.sourceCategoryId, dragging.task.id, target);
        }
        draggingRef.current = null;
        hoveredRef.current = null;
        setDraggedTask(null);
        setHoveredCategoryId(null);
        setIsDragging(false);
    }, [fingerX, fingerY, moveTask, currentRects]);

    // Clear the lifted/dragging state WITHOUT performing a move (e.g. the user
    // held and released in place, or the drag was cancelled).
    const cancelDrag = useCallback(() => {
        draggingRef.current = null;
        hoveredRef.current = null;
        setDraggedTask(null);
        setHoveredCategoryId(null);
        setIsDragging(false);
    }, []);

    // Ghost is horizontally fixed/centered and tracks the finger on the Y axis
    // only (Notion-style). Hit-testing still uses the real finger X/Y.
    const ghostStyle = useAnimatedStyle(() => ({
        position: "absolute",
        left: "5%",
        right: "5%",
        top: 0,
        transform: [{ translateY: fingerY.value - 30 }],
        opacity: 0.95,
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
                setScrollOffset,
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
        shadowColor: "#000",
        shadowOpacity: 0.25,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 8,
    },
});
