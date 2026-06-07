import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { TouchableOpacity, View, StyleSheet, Dimensions, Platform } from "react-native";
import { ThemedText } from "../ThemedText";
import { useRouter } from "expo-router";
import { useThemeColor } from "@/hooks/useThemeColor";
import EditPost from "../modals/edit/EditPost";
import { Task } from "@/api/types";
import { isTaskEncouraged, encouragedCardColors } from "./encouragedTask";
import EncouragerAvatars from "./EncouragerAvatars";
import Svg, { Circle, Rect, Path } from "react-native-svg";
import ConditionalView from "../ui/ConditionalView";
import { useTasks } from "@/contexts/tasksContext";
import { useDebounce } from "@/hooks/useDebounce";
import EncourageModal from "../modals/EncourageModal";
import CongratulateModal from "../modals/CongratulateModal";
import { isAfter, formatDistanceToNow, parseISO, isBefore, isToday, isTomorrow, differenceInDays, format, isThisWeek } from "date-fns";
import { Sparkle, Timer, Repeat, Camera } from "phosphor-react-native";
import { getIntegrationIcon } from "@/utils/integrationUtils";
import CustomAlert, { AlertButton } from "@/components/modals/CustomAlert";
import { useAnalytics } from "@/hooks/useAnalytics";
import { AnalyticsEvents } from "@/utils/analytics";
import { ActiveTaskActivityFactory } from "@/widgets/widgetUpdaters";
import { showToastable } from "react-native-toastable";
import DefaultToast from "@/components/ui/DefaultToast";
import { setWorkingAPI } from "@/api/task";
import * as Haptics from "expo-haptics";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { useDragOptional } from "@/contexts/dragContext";

export const PRIORITY_MAP = {
    0: "none",
    1: "low",
    2: "medium",
    3: "high",
} as const;

type Priority = keyof typeof PRIORITY_MAP;
type PriorityLevel = (typeof PRIORITY_MAP)[Priority];

// Press-and-hold tuning for the drag/menu gesture.
const LONG_PRESS_MS = 350; // hold before the drag gesture activates
const MENU_HOLD_DELAY_MS = 850; // extra still-hold after activation → menu opens (~1.2s total)
const DRAG_MOVE_THRESHOLD = 10; // px of travel that turns a hold into a drag

interface Props {
    content: string;
    value: number;
    priority: Priority;
    redirect?: boolean;
    encourage?: boolean;
    congratulate?: boolean;
    id: string;
    categoryId: string;
    task?: Task;
    height?: number;
    showRedOutline?: boolean; // Add red outline when categoryId is not configured
    detailed?: boolean; // Controls whether to show date labels like "(today)" or "(tomorrow)"
    inlineComponent?: React.ReactNode; // Optional component to render inline below the content text
    onPostPress?: () => void; // When provided, renders a camera button that starts a post for this task
    highlightContent?: boolean; // Whether to highlight just the task content text
    encouragementConfig?: {
        userHandle?: string;
        receiverId: string;
        categoryName: string;
    };
    congratulationConfig?: {
        userHandle?: string;
        receiverId: string;
        categoryName: string;
    };
}

const TaskCard = ({
    content,
    value,
    priority,
    redirect = false,
    inlineComponent,
    onPostPress,
    id,
    categoryId,
    encourage = false,
    congratulate = false,
    task,
    height = Dimensions.get("window").height * 0.07,
    showRedOutline = false,
    detailed = true,
    highlightContent = false,
    encouragementConfig,
    congratulationConfig,
}: Props) => {
    const router = useRouter();
    const [editing, setEditing] = useState(false);
    const [showEncourageModal, setShowEncourageModal] = useState(false);
    const [showCongratulateModal, setShowCongratulateModal] = useState(false);
    const ThemedColor = useThemeColor();
    const encouraged = isTaskEncouraged(task);
    const encColors = encouragedCardColors(ThemedColor.primary);
    const { setTask, updateTask } = useTasks();
    const [isRunningState, setIsRunningState] = useState(false);
    const isMounted = useRef(true);
    const lastTapRef = useRef<number>(0);
    const singleTapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const menuTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const menuOpenedRef = useRef(false);
    const movedRef = useRef(false);
    const { capture } = useAnalytics();

    // Alert state
    const [alertVisible, setAlertVisible] = useState(false);
    const [alertTitle, setAlertTitle] = useState("");
    const [alertMessage, setAlertMessage] = useState("");
    const [alertButtons, setAlertButtons] = useState<AlertButton[]>([]);

    const debouncedRedirect = useDebounce(() => {
        if (!redirect) return;
        router.push({
            pathname: "/(logged-in)/(tabs)/(task)/task/[id]",
            params: { name: content, id: id, categoryId: categoryId },
        });
    }, 200);

    useEffect(() => {
        return () => {
            isMounted.current = false;
            if (singleTapTimeoutRef.current) {
                clearTimeout(singleTapTimeoutRef.current);
            }
            if (menuTimerRef.current) {
                clearTimeout(menuTimerRef.current);
            }
        };
    }, []);

    // Timer state check removed for performance - was unused

    // Calculate date display text and color
    const dateDisplay = useMemo(() => {
        if (task?.isPhantom && task?.nextGenerated) {
            const nextDate = parseISO(task.nextGenerated);
            let label: string;
            if (isToday(nextDate)) {
                label = "today";
            } else if (isTomorrow(nextDate)) {
                label = "tomorrow";
            } else {
                const days = differenceInDays(nextDate, new Date());
                if (days <= 6) {
                    label = format(nextDate, "EEEE"); // "Monday", "Tuesday", etc.
                } else {
                    label = format(nextDate, "MMM d"); // "Apr 2", "Mar 30"
                }
            }
            return { text: label, color: "caption" as const };
        }

        if (!detailed) return null;

        const now = new Date();

        // Priority 1: If task has both startTime and deadline, decide based on whether
        // we're before or after the start time
        if (task?.startTime && task?.deadline) {
            try {
                const startDate = parseISO(task.startTime);
                const deadlineDate = parseISO(task.deadline);

                if (isBefore(now, startDate)) {
                    // Still before the start — show when it starts
                    const duration = formatDistanceToNow(startDate, { addSuffix: true });
                    return {
                        text: `(starts ${duration})`,
                        color: 'caption' as const
                    };
                } else {
                    // Start has passed — focus on the deadline
                    const isOverdue = isAfter(now, deadlineDate);
                    if (isOverdue) {
                        const duration = formatDistanceToNow(deadlineDate, { addSuffix: false });
                        return {
                            text: `Due ${duration} ago`,
                            color: 'error' as const
                        };
                    } else {
                        let text = formatDistanceToNow(deadlineDate, { addSuffix: true });
                        text = text.replace(/^in /, 'due in ');
                        return {
                            text: `(${text})`,
                            color: 'caption' as const
                        };
                    }
                }
            } catch (error) {
                console.error("Error parsing start/end time:", error);
            }
        }

        // Priority 2: Show deadline if it exists (no startTime)
        if (task?.deadline) {
            try {
                const deadlineDate = parseISO(task.deadline);
                const isOverdue = isAfter(now, deadlineDate);

                if (isOverdue) {
                    const duration = formatDistanceToNow(deadlineDate, { addSuffix: false });
                    return {
                        text: `Due ${duration} ago`,
                        color: 'error' as const
                    };
                } else {
                    let text = formatDistanceToNow(deadlineDate, { addSuffix: true });
                    text = text.replace(/^in /, 'due in ');
                    return {
                        text: `(${text})`,
                        color: 'caption' as const
                    };
                }
            } catch (error) {
                console.error("Error parsing deadline:", error);
                return null;
            }
        }

        // Priority 3: Show start date if it exists and no deadline
        if (task?.startDate && !task?.deadline) {
            try {
                const startDate = parseISO(task.startDate);

                if (isToday(startDate)) {
                    return {
                        text: '(today)',
                        color: 'caption' as const
                    };
                } else if (isTomorrow(startDate)) {
                    return {
                        text: '(tomorrow)',
                        color: 'caption' as const
                    };
                } else if (isAfter(now, startDate)) {
                    const duration = formatDistanceToNow(startDate, { addSuffix: false });
                    return {
                        text: `(${duration} ago)`,
                        color: 'caption' as const
                    };
                } else {
                    const duration = formatDistanceToNow(startDate, { addSuffix: true });
                    return {
                        text: `(${duration})`,
                        color: 'caption' as const
                    };
                }
            } catch (error) {
                console.error("Error parsing start date:", error);
                return null;
            }
        }

        return null;
    }, [task?.deadline, task?.startDate, task?.startTime, task?.isPhantom, task?.nextGenerated, detailed]);

    const getPriorityColor = (level: PriorityLevel) => {
        switch (level) {
            case "none":
                return ThemedColor.disabled + "00";
            case "low":
                return ThemedColor.success;
            case "medium":
                return ThemedColor.warning;
            case "high":
                return ThemedColor.error;
        }
    };

    const startWorking = () => {
        if (!task || task.isPhantom) return;

        if (Platform.OS === "ios") {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }

        const now = new Date().toISOString();
        const endTime = task.deadline || undefined;

        ActiveTaskActivityFactory.start({
            taskName: task.content,
            workspaceName: task.workspaceName || 'Tasks',
            startTime: now,
            endTime,
            hasEndTime: !!endTime,
            categoryId,
            taskId: id,
        });

        // Update local state immediately so WorkingOnRow shows
        updateTask(categoryId, id, { workingOnSince: now });

        // Persist working state to backend
        setWorkingAPI(categoryId, id, true).catch(() => {});

        showToastable({
            title: "Let's go!",
            message: `Now working on "${task.content}"`,
            status: "success" as any,
            duration: 2500,
            renderContent: (props) => <DefaultToast {...props} />,
        });
    };

    const handleSingleTap = () => {
        capture(AnalyticsEvents.TASK_DETAIL_OPENED, {});
        if (task?.isPhantom) return;
        if (encourage) {
            if (!encouragementConfig?.receiverId || encouragementConfig.receiverId.trim() === "") {
                console.error("Cannot show encourage modal: missing receiverId");
                setAlertTitle("Error");
                setAlertMessage("Unable to send encouragement at this time. Please try again later.");
                setAlertButtons([{ text: "OK", style: "default" }]);
                setAlertVisible(true);
                return;
            }
            setShowEncourageModal(true);
        }
        if (congratulate) {
            if (!congratulationConfig?.receiverId || congratulationConfig.receiverId.trim() === "") {
                console.error("Cannot show congratulate modal: missing receiverId");
                setAlertTitle("Error");
                setAlertMessage("Unable to send congratulation at this time. Please try again later.");
                setAlertButtons([{ text: "OK", style: "default" }]);
                setAlertVisible(true);
                return;
            }
            setShowCongratulateModal(true);
        }
        if (task) {
            setTask(task);
            debouncedRedirect();
        }
    };

    const handlePress = () => {
        const now = Date.now();
        const DOUBLE_TAP_DELAY = 300;

        if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
            // Double tap detected
            if (singleTapTimeoutRef.current) {
                clearTimeout(singleTapTimeoutRef.current);
                singleTapTimeoutRef.current = null;
            }
            lastTapRef.current = 0;
            if (redirect && task && !task.isPhantom) {
                startWorking();
            }
            return;
        }

        lastTapRef.current = now;
        singleTapTimeoutRef.current = setTimeout(() => {
            singleTapTimeoutRef.current = null;
            handleSingleTap();
        }, DOUBLE_TAP_DELAY);
    };

    const handleLongPress = () => {
        if (task?.isPhantom) return;
        if (!redirect) return;

        setEditing(true);
    };

    // ── Drag-and-drop gesture (only active when DragProvider is present) ──
    const drag = useDragOptional();
    const draggable = Boolean(drag) && Boolean(redirect) && !task?.isPhantom && Boolean(task);

    const onLift = useCallback((absX: number, absY: number) => {
        if (Platform.OS === "ios") {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
        movedRef.current = false;
        menuOpenedRef.current = false;
        if (task && drag) drag.beginDrag(task, categoryId, absX, absY);
        // Held still past ~1s total → surface the menu without waiting for release.
        menuTimerRef.current = setTimeout(() => {
            menuTimerRef.current = null;
            if (movedRef.current) return;
            menuOpenedRef.current = true;
            drag?.cancelDrag();
            if (Platform.OS === "ios") {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
            setEditing(true);
        }, MENU_HOLD_DELAY_MS);
    }, [task, categoryId, drag]);

    const onMove = useCallback((x: number, y: number, translationX: number, translationY: number) => {
        if (menuOpenedRef.current) return;
        if (!movedRef.current && Math.hypot(translationX, translationY) > DRAG_MOVE_THRESHOLD) {
            movedRef.current = true;
            if (menuTimerRef.current) {
                clearTimeout(menuTimerRef.current);
                menuTimerRef.current = null;
            }
        }
        drag?.updateDrag(x, y);
    }, [drag]);

    // moved=true → the finger travelled, so treat the release as a drop;
    // moved=false → held and released in place, so open the menu (if the
    // hold-timer hasn't already opened it mid-press).
    const finishDrag = useCallback((moved: boolean) => {
        if (menuTimerRef.current) {
            clearTimeout(menuTimerRef.current);
            menuTimerRef.current = null;
        }
        if (!drag) return;
        if (menuOpenedRef.current) return;
        if (moved) {
            drag.endDrag();
        } else {
            drag.cancelDrag();
            setEditing(true);
        }
    }, [drag]);

    // Single Pan gesture that activates only after a 350ms hold (RNGH's
    // press-and-hold-then-drag primitive). No shared JS refs cross the worklet
    // boundary, and every callback handed to runOnJS is a stable named function.
    const dragGesture = useMemo(
        () =>
            Gesture.Pan()
                .activateAfterLongPress(LONG_PRESS_MS)
                .onStart((e) => {
                    runOnJS(onLift)(e.absoluteX, e.absoluteY);
                })
                .onUpdate((e) => {
                    runOnJS(onMove)(e.absoluteX, e.absoluteY, e.translationX, e.translationY);
                })
                .onEnd((e) => {
                    const moved = Math.hypot(e.translationX, e.translationY) > DRAG_MOVE_THRESHOLD;
                    runOnJS(finishDrag)(moved);
                }),
        [onLift, onMove, finishDrag]
    );

    const cardBody = (
        <TouchableOpacity
            style={[
                styles.container,
                encouraged
                    ? {
                          backgroundColor: encColors.background,
                          borderWidth: 1,
                          borderColor: encColors.border,
                          ...encColors.glow,
                      }
                    : {
                          backgroundColor: ThemedColor.lightenedCard,
                          borderWidth: 1,
                          borderColor: ThemedColor.tertiary,
                      },
                task?.isPhantom
                    ? { opacity: 0.45, borderStyle: "dashed" as const }
                    : null,
            ]}
            disabled={
                Boolean(task?.isPhantom) ||
                (!redirect && !encourage && !congratulate)
            }
            onPress={handlePress}
            onLongPress={draggable ? undefined : handleLongPress}>
            {editing && (
                <EditPost
                    visible={editing}
                    setVisible={setEditing}
                    id={{ id, category: categoryId }}
                    task={task}
                    onStartWorking={task && !task.isPhantom ? startWorking : undefined}
                />
            )}

            <View style={styles.row}>
                <View style={styles.contentContainer}>
                    {highlightContent ? (
                        <ThemedText numberOfLines={2} ellipsizeMode="tail" style={[styles.content, encouraged ? { color: encColors.text } : null]} type="default">
                            {content}
                            {dateDisplay && (
                                <ThemedText type="default" style={{ color: encouraged ? encColors.secondaryText : ThemedColor[dateDisplay.color] }}>
                                    {" "}{dateDisplay.text}
                                </ThemedText>
                            )}
                        </ThemedText>
                    ) : (
                        <ThemedText numberOfLines={2} ellipsizeMode="tail" style={[styles.content, encouraged ? { color: encColors.text } : null]} type="default">
                            {content}
                            {task?.workingOnSince && (
                                <ThemedText type="default" style={{ color: encouraged ? encColors.secondaryText : ThemedColor.primary }}>
                                    {" "}(active)
                                </ThemedText>
                            )}
                            {dateDisplay && (
                                <ThemedText type="default" style={{ color: encouraged ? encColors.secondaryText : ThemedColor[dateDisplay.color] }}>
                                    {" "}{dateDisplay.text}
                                </ThemedText>
                            )}
                        </ThemedText>
                    )}
                    {inlineComponent && <View style={styles.inlineWrapper}>{inlineComponent}</View>}
                </View>
                <View style={styles.iconRow}>
                    <ConditionalView condition={encouraged}>
                        <EncouragerAvatars
                            encouragements={task?.encouragements ?? []}
                            ringColor={ThemedColor.background}
                            placeholderColor={ThemedColor.primary}
                        />
                    </ConditionalView>
                    {onPostPress && (
                        <TouchableOpacity
                            testID="task-card-post-button"
                            hitSlop={8}
                            onPress={(e) => {
                                e?.stopPropagation?.();
                                onPostPress();
                            }}>
                            <Camera size={20} color={ThemedColor.caption} weight="regular" />
                        </TouchableOpacity>
                    )}
                    <ConditionalView condition={!encourage}>
                        <ConditionalView condition={isRunningState}>
                            <Timer size={20} color={ThemedColor.caption} weight="regular" />
                        </ConditionalView>
                        <ConditionalView condition={task?.recurring}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                                <Repeat size={20} color={ThemedColor.caption} weight="regular" />
                                {task?.flexInfo && (
                                    <ThemedText type="caption" style={{ color: encouraged ? encColors.secondaryText : ThemedColor.primary, fontWeight: "600", fontSize: 12 }}>
                                        {task.flexInfo.instanceNumber}/{task.flexInfo.target}
                                    </ThemedText>
                                )}
                            </View>
                        </ConditionalView>
                        <ConditionalView condition={!!task?.integration}>
                            {getIntegrationIcon(task?.integration, ThemedColor.caption)}
                        </ConditionalView>
                        {/* <ThemedText type="caption" style={{ color: ThemedColor.caption }}>
                        {value}
                    </ThemedText> */}

                        {/* Encouraged tasks show a sparkle in place of the priority dot */}
                        {encouraged ? (
                            <Sparkle size={20} color={ThemedColor.primary} weight="fill" />
                        ) : (
                            <View
                                style={[styles.circle, { backgroundColor: task?.workingOnSince ? ThemedColor.primary : getPriorityColor(PRIORITY_MAP[priority]) }]}
                            />
                        )}
                    </ConditionalView>
                    <ConditionalView condition={encourage}>
                        <Sparkle
                            size={24}
                            color="#9333EA"
                            weight="regular"
                        />
                    </ConditionalView>
                    <ConditionalView condition={congratulate}>
                        <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                            <Path
                                d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z"
                                fill="#FFD700"
                            />
                        </Svg>
                    </ConditionalView>
                </View>
            </View>
        </TouchableOpacity>
    );

    return (
        <>
            {draggable ? (
                <GestureDetector gesture={dragGesture}>{cardBody}</GestureDetector>
            ) : (
                cardBody
            )}

            {/* Lazy load modals - only render when needed */}
            {showEncourageModal && (
                <EncourageModal
                    visible={showEncourageModal}
                    setVisible={setShowEncourageModal}
                    task={{
                        id,
                        content,
                        value,
                        priority,
                        categoryId,
                    }}
                    encouragementConfig={encouragementConfig}
                />
            )}

            {showCongratulateModal && (
                <CongratulateModal
                    visible={showCongratulateModal}
                    setVisible={setShowCongratulateModal}
                    task={{
                        id,
                        content,
                        value,
                        priority,
                        categoryId,
                    }}
                    congratulationConfig={congratulationConfig}
                />
            )}

            {alertVisible && (
                <CustomAlert
                    visible={alertVisible}
                    setVisible={setAlertVisible}
                    title={alertTitle}
                    message={alertMessage}
                    buttons={alertButtons}
                />
            )}
        </>
    );
};

// Memoize TaskCard to prevent unnecessary re-renders
export default React.memo(TaskCard, (prevProps, nextProps) => {
    // Only re-render if these specific props change
    return (
        prevProps.content === nextProps.content &&
        prevProps.id === nextProps.id &&
        prevProps.priority === nextProps.priority &&
        prevProps.value === nextProps.value &&
        prevProps.redirect === nextProps.redirect &&
        prevProps.encourage === nextProps.encourage &&
        prevProps.congratulate === nextProps.congratulate &&
        prevProps.showRedOutline === nextProps.showRedOutline &&
        prevProps.detailed === nextProps.detailed &&
        prevProps.highlightContent === nextProps.highlightContent &&
        prevProps.task?.deadline === nextProps.task?.deadline &&
        prevProps.task?.startDate === nextProps.task?.startDate &&
        prevProps.task?.startTime === nextProps.task?.startTime &&
        prevProps.task?.active === nextProps.task?.active &&
        prevProps.task?.recurring === nextProps.task?.recurring &&
        prevProps.task?.flexInfo?.instanceNumber === nextProps.task?.flexInfo?.instanceNumber &&
        prevProps.task?.integration === nextProps.task?.integration &&
        prevProps.task?.isPhantom === nextProps.task?.isPhantom &&
        prevProps.task?.nextGenerated === nextProps.task?.nextGenerated
    );
});

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderRadius: 16,
        justifyContent: "center",
    },
    row: {
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 6,
        minHeight: 20,
    },
    circle: {
        width: 10,
        height: 10,
        borderRadius: 10,
    },
    contentContainer: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        width: "90%",
        margin: "auto",
        gap: 6,
    },
    content: {
        textAlign: "left",
        lineHeight: 24,
    },
    inlineWrapper: {
        marginTop: 2,
    },
    iconRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        minHeight: 20,
        height: "100%"
    },
});
