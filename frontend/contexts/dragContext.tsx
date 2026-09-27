import React, { createContext, useCallback, useContext, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Platform, StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import Reanimated, {
    useSharedValue,
    useAnimatedStyle,
    SharedValue,
} from "react-native-reanimated";
import { Task } from "@/api/types";
import { CategoryRect, categoryAtPoint } from "@/utils/dragHitTest";
import { useTaskActions } from "@/contexts/tasksContext";
import TaskCard from "@/components/cards/TaskCard";

// Stable for the provider's lifetime — consumers of only these never re-render
// because of drag state (important for the per-task cards).
export type DragActions = {
    fingerX: SharedValue<number>;
    fingerY: SharedValue<number>;
    /** Scroll offset of the drag host's list, written from a UI-thread scroll handler. */
    scrollY: SharedValue<number>;
    setCategoryRect: (rect: CategoryRect) => void;
    removeCategoryRect: (categoryId: string) => void;
    setScrollOffset: (y: number) => void;
    beginDrag: (task: Task, sourceCategoryId: string, startX: number, startY: number) => void;
    updateDrag: (x: number, y: number) => void;
    endDrag: () => void;
    cancelDrag: () => void;
    subscribeHover: (listener: () => void) => () => void;
    getHoveredCategoryId: () => string | null;
};

type DragContextValue = DragActions & {
    isDragging: boolean;
};

const DragActionsContext = createContext<DragActions | null>(null);
const DragStateContext = createContext<boolean>(false);

// Flip to true to surface drag hit-test logs while debugging.
const DRAG_DEBUG = false;
const dlog = (...args: unknown[]) => {
    if (DRAG_DEBUG) console.log("[drag]", ...args);
};

export const useDrag = (): DragContextValue => {
    const ctx = useDragOptional();
    if (!ctx) throw new Error("useDrag must be used within DragProvider");
    return ctx;
};

/**
 * Like useDrag but returns null when there is no DragProvider above (e.g. a
 * Category or TaskCard rendered in a view-only / encourage / congratulate
 * context). Lets drag-aware components degrade gracefully instead of throwing.
 */
export const useDragOptional = (): DragContextValue | null => {
    const actions = useContext(DragActionsContext);
    const isDragging = useContext(DragStateContext);
    return useMemo(() => (actions ? { ...actions, isDragging } : null), [actions, isDragging]);
};

/** Stable drag functions only; never re-renders on drag start/hover/end. */
export const useDragActionsOptional = (): DragActions | null => useContext(DragActionsContext);

/** Only re-renders when drag starts/ends. */
export const useIsDragging = (): boolean => useContext(DragStateContext);

const noopSubscribe = () => () => {};

/** True while `categoryId` is the hovered drop target; re-renders only when that flips. */
export const useIsDropTarget = (categoryId: string): boolean => {
    const actions = useContext(DragActionsContext);
    return useSyncExternalStore(
        actions?.subscribeHover ?? noopSubscribe,
        () => (actions ? actions.getHoveredCategoryId() === categoryId : false)
    );
};

export const DragProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { moveTask } = useTaskActions();

    const fingerX = useSharedValue(0);
    const fingerY = useSharedValue(0);
    const scrollY = useSharedValue(0);

    const rectsRef = useRef<Map<string, CategoryRect>>(new Map());
    const draggingRef = useRef<{ task: Task; sourceCategoryId: string } | null>(null);
    const hoveredRef = useRef<string | null>(null);
    const hoverListenersRef = useRef<Set<() => void>>(new Set());

    const [isDragging, setIsDragging] = useState(false);
    const [draggedTask, setDraggedTask] = useState<Task | null>(null);

    const subscribeHover = useCallback((listener: () => void) => {
        hoverListenersRef.current.add(listener);
        return () => {
            hoverListenersRef.current.delete(listener);
        };
    }, []);

    const getHoveredCategoryId = useCallback(() => hoveredRef.current, []);

    const setHovered = useCallback((id: string | null) => {
        if (hoveredRef.current === id) return;
        hoveredRef.current = id;
        hoverListenersRef.current.forEach((fn) => fn());
    }, []);

    const setCategoryRect = useCallback((rect: CategoryRect) => {
        // Stamp the scroll offset at measure time so hit-testing can correct
        // for any scrolling that happens before/while a drag is in flight.
        const scrollYAtMeasure = scrollY.value;
        rectsRef.current.set(rect.categoryId, { ...rect, scrollYAtMeasure });
        dlog("rect set", rect.categoryId, `y=${Math.round(rect.y)} h=${Math.round(rect.height)} scrollY=${Math.round(scrollYAtMeasure)}`, `(total ${rectsRef.current.size})`);
    }, [scrollY]);

    const removeCategoryRect = useCallback((categoryId: string) => {
        rectsRef.current.delete(categoryId);
    }, []);

    const setScrollOffset = useCallback((y: number) => {
        scrollY.value = y;
    }, [scrollY]);

    // Rects shifted by however far the list has scrolled since each was measured.
    const currentRects = useCallback((): CategoryRect[] => {
        const y = scrollY.value;
        return Array.from(rectsRef.current.values()).map((r) => ({
            ...r,
            y: r.y - (y - (r.scrollYAtMeasure ?? 0)),
        }));
    }, [scrollY]);

    const beginDrag = useCallback((task: Task, sourceCategoryId: string, startX: number, startY: number) => {
        draggingRef.current = { task, sourceCategoryId };
        setHovered(null);
        fingerX.value = startX;
        fingerY.value = startY;
        setDraggedTask(task);
        setIsDragging(true);
        dlog("lift", `task=${task.id}`, `from=${sourceCategoryId}`, `at=(${Math.round(startX)},${Math.round(startY)})`, `rects=${rectsRef.current.size}`);
    }, [fingerX, fingerY, setHovered]);

    const updateDrag = useCallback((x: number, y: number) => {
        fingerX.value = x;
        fingerY.value = y;
        const hit = categoryAtPoint(currentRects(), x, y);
        if (hit !== hoveredRef.current) {
            dlog("hover →", hit ?? "(none)", `finger=(${Math.round(x)},${Math.round(y)})`, `scrollY=${Math.round(scrollY.value)}`);
            setHovered(hit);
            // Light tick when the finger crosses into a new drop zone (not the
            // source it's already in — that would just buzz right after lift).
            if (hit && hit !== draggingRef.current?.sourceCategoryId && Platform.OS === "ios") {
                Haptics.selectionAsync();
            }
        }
    }, [fingerX, fingerY, scrollY, currentRects, setHovered]);

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
        setHovered(null);
        setDraggedTask(null);
        setIsDragging(false);
    }, [fingerX, fingerY, moveTask, currentRects, setHovered]);

    // Clear the lifted/dragging state WITHOUT performing a move (e.g. the user
    // held and released in place, or the drag was cancelled).
    const cancelDrag = useCallback(() => {
        draggingRef.current = null;
        setHovered(null);
        setDraggedTask(null);
        setIsDragging(false);
    }, [setHovered]);

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

    const actions = useMemo<DragActions>(
        () => ({
            fingerX,
            fingerY,
            scrollY,
            setCategoryRect,
            removeCategoryRect,
            setScrollOffset,
            beginDrag,
            updateDrag,
            endDrag,
            cancelDrag,
            subscribeHover,
            getHoveredCategoryId,
        }),
        [
            fingerX, fingerY, scrollY,
            setCategoryRect, removeCategoryRect, setScrollOffset,
            beginDrag, updateDrag, endDrag, cancelDrag,
            subscribeHover, getHoveredCategoryId,
        ]
    );

    return (
        <DragActionsContext.Provider value={actions}>
            <DragStateContext.Provider value={isDragging}>
                {children}
            </DragStateContext.Provider>
            {isDragging && draggedTask && (
                <View style={StyleSheet.absoluteFill} pointerEvents="none">
                    <Reanimated.View style={[styles.ghost, ghostStyle]}>
                        <TaskCard
                            content={draggedTask.content}
                            value={draggedTask.value}
                            priority={draggedTask.priority as 0 | 1 | 2 | 3}
                            id={draggedTask.id}
                            categoryId={draggedTask.categoryID ?? ""}
                            task={draggedTask}
                        />
                    </Reanimated.View>
                </View>
            )}
        </DragActionsContext.Provider>
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
