import React, { useState, useRef, useEffect, useCallback } from "react";
import { View, TouchableOpacity, StyleSheet, Alert, Platform } from "react-native";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    runOnJS,
    useAnimatedReaction,
    scrollTo,
    SharedValue,
    AnimatedRef,
    useAnimatedScrollHandler,
} from "react-native-reanimated";
import { router } from "expo-router";
import { isSameDay } from "date-fns";
import * as Haptics from "expo-haptics";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import UnscheduledTasksSection from "@/components/task/UnscheduledTasksSection";
import DefaultModal from "@/components/modals/DefaultModal";
import { Ionicons } from "@expo/vector-icons";
import { useTasks } from "@/contexts/tasksContext";
import { updateTaskAPI, removeFromCategoryAPI, markAsCompletedAPI } from "@/api/task";
import { CalendarEventCard } from "./CalendarEventCard";
import { TimeRangeGhostBlock } from "./TimeRangeGhostBlock";
import { useDailyTasks } from "@/hooks/useDailyTasks";
import { logger } from "@/utils/logger";

const TIME_LABEL_WIDTH = 40;
const DEFAULT_BLOCK_MINUTES = 30;

export interface ScheduleTimeRange {
    startMinutes: number;
    endMinutes: number;
}

interface CalendarViewProps {
    selectedDate: Date;
    animatedScrollY: SharedValue<number>;
    scrollViewRef: AnimatedRef<Animated.ScrollView>;
    headerContent?: React.ReactNode;
    onDragCreateComplete?: (range: ScheduleTimeRange) => void;
}

const formatMinutesToTime = (totalMinutes: number): string => {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    const ampm = h >= 12 ? "PM" : "AM";
    const dh = h % 12 || 12;
    return `${dh}:${m.toString().padStart(2, "0")} ${ampm}`;
};

const CalendarViewComponent: React.FC<CalendarViewProps> = ({
    selectedDate,
    animatedScrollY,
    scrollViewRef,
    headerContent,
    onDragCreateComplete,
}) => {
    const ThemedColor = useThemeColor();
    const { setSelected, updateTask, removeFromCategory } = useTasks();
    const { tasksWithSpecificTime, tasksForTodayNoTime, tasksUnscheduled } =
        useDailyTasks(selectedDate);
    const currentTimeLineRef = useRef<View>(null);
    const hasScrolledToFirstEvent = useRef(false);

    // Context menu state
    const [contextMenuVisible, setContextMenuVisible] = useState(false);
    const [selectedTask, setSelectedTask] = useState<any>(null);
    const [isHiding, setIsHiding] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isCompleting, setIsCompleting] = useState(false);

    // Ghost block state
    const [ghostBlockVisible, setGhostBlockVisible] = useState(false);
    const ghostBlockVisibleRef = useRef(false);
    const ghostStartMinutes = useSharedValue(0);
    const ghostEndMinutes = useSharedValue(0);
    const [ghostTimeLabel, setGhostTimeLabel] = useState("");

    useEffect(() => {
        ghostBlockVisibleRef.current = ghostBlockVisible;
    }, [ghostBlockVisible]);

    // Shared values for pinch gesture
    const hourHeightShared = useSharedValue(60);
    const [hourHeight, setHourHeight] = useState(60);
    const initialPinchHeightShared = useSharedValue(60);
    const initialScrollPositionShared = useSharedValue(0);
    const focalPointYShared = useSharedValue(0);
    const isPinchingShared = useSharedValue(false);
    const [isPinching, setIsPinching] = useState(false);

    const scrollEnabled = !ghostBlockVisible;

    useAnimatedReaction(
        () => hourHeightShared.value,
        (currentHeight, previousHeight) => {
            if (isPinchingShared.value && previousHeight !== null) {
                const scale = currentHeight / initialPinchHeightShared.value;
                const initialScrollY = initialScrollPositionShared.value;
                const focalOffsetY = focalPointYShared.value;
                const contentAtFocal = initialScrollY + focalOffsetY;
                const newScrollY = contentAtFocal * scale - focalOffsetY;
                scrollTo(scrollViewRef, 0, Math.max(0, newScrollY), false);
            }
        }
    );

    // --- Pinch Gesture ---
    const pinchGesture = Gesture.Pinch()
        .enabled(!ghostBlockVisible)
        .onBegin((event) => {
            initialPinchHeightShared.value = hourHeightShared.value;
            focalPointYShared.value = event.focalY - 200;
            initialScrollPositionShared.value = animatedScrollY.value;
            isPinchingShared.value = true;
            runOnJS(setIsPinching)(true);
        })
        .onUpdate((event) => {
            const newHeight = initialPinchHeightShared.value * event.scale;
            const clampedHeight = Math.max(30, Math.min(120, newHeight));
            hourHeightShared.value = clampedHeight;
            if (Math.abs(clampedHeight - hourHeight) > 2) {
                runOnJS(setHourHeight)(clampedHeight);
            }
        })
        .onEnd(() => {
            isPinchingShared.value = false;
            hourHeightShared.value = withSpring(hourHeightShared.value, {
                damping: 25,
                stiffness: 400,
            });
            runOnJS(setIsPinching)(false);
        })
        .onFinalize(() => {
            isPinchingShared.value = false;
            runOnJS(setIsPinching)(false);
        });

    // --- Ghost block helpers ---

    const updateGhostLabel = useCallback(
        (startMins: number, endMins: number) => {
            setGhostTimeLabel(
                `${formatMinutesToTime(startMins)} - ${formatMinutesToTime(endMins)}`
            );
        },
        []
    );

    const showGhostBlock = useCallback(
        (y: number) => {
            const rawMinutes = (y / hourHeightShared.value) * 60;
            const snapped = Math.max(
                0,
                Math.min(
                    1440 - DEFAULT_BLOCK_MINUTES,
                    Math.round(rawMinutes / 15) * 15
                )
            );
            const endMins = Math.min(1440, snapped + DEFAULT_BLOCK_MINUTES);

            ghostStartMinutes.value = snapped;
            ghostEndMinutes.value = endMins;
            setGhostTimeLabel(
                `${formatMinutesToTime(snapped)} - ${formatMinutesToTime(endMins)}`
            );
            setGhostBlockVisible(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        },
        [hourHeightShared]
    );

    const handleGhostConfirm = useCallback(() => {
        const s = ghostStartMinutes.value;
        const e = ghostEndMinutes.value;
        setGhostBlockVisible(false);
        onDragCreateComplete?.({ startMinutes: s, endMinutes: e });
    }, [onDragCreateComplete]);

    const handleGhostDismiss = useCallback(() => {
        setGhostBlockVisible(false);
    }, []);

    const handleGridTapJS = useCallback(
        (y: number) => {
            if (ghostBlockVisibleRef.current) {
                // Check if tap is inside the ghost block range → confirm, else dismiss
                const topPx =
                    (ghostStartMinutes.value / 60) * hourHeightShared.value;
                const bottomPx =
                    (ghostEndMinutes.value / 60) * hourHeightShared.value;
                if (y >= topPx - 12 && y <= bottomPx + 12) {
                    handleGhostConfirm();
                } else {
                    handleGhostDismiss();
                }
            } else {
                showGhostBlock(y);
            }
        },
        [showGhostBlock, handleGhostConfirm, handleGhostDismiss, hourHeightShared]
    );

    // --- Tap Gesture (RNGH — works inside GestureDetector) ---
    const tapGesture = Gesture.Tap()
        .maxDuration(250)
        .onEnd((event) => {
            "worklet";
            // Only handle taps in the tasks area (right of time labels)
            if (event.x > TIME_LABEL_WIDTH) {
                runOnJS(handleGridTapJS)(event.y);
            }
        });

    // Compose: tap + pinch can run simultaneously (1 finger vs 2 fingers)
    const composedGesture = Gesture.Simultaneous(tapGesture, pinchGesture);

    // --- Styles ---

    const themedStyles = StyleSheet.create({
        currentTimeLine: {
            position: "absolute",
            left: 0,
            right: 0,
            height: 3,
            backgroundColor: "#ef4444",
            zIndex: 10,
            shadowColor: "#ef4444",
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.5,
            shadowRadius: 3,
        },
        currentTimeIndicator: {
            width: 14,
            height: 14,
            borderRadius: 7,
            backgroundColor: "#ef4444",
            position: "absolute",
            top: -6,
            left: -7,
            zIndex: 11,
            borderWidth: 2,
            borderColor: "#ffffff",
        },
        hourLine: {
            position: "absolute",
            left: TIME_LABEL_WIDTH,
            right: 0,
            height: 1,
            backgroundColor: ThemedColor.caption,
            opacity: 0.2,
            zIndex: 1,
        },
    });

    const animatedScheduleContentStyle = useAnimatedStyle(() => ({
        flexDirection: "row",
        gap: 32,
        position: "relative",
        height: 24 * hourHeightShared.value,
        opacity: withSpring(isPinching ? 0.8 : 1, { damping: 20 }),
    }));

    const animatedTimeLabelStyle = useAnimatedStyle(() => ({
        height: hourHeightShared.value,
        justifyContent: "flex-start",
        position: "absolute",
        left: 0,
        right: 0,
    }));

    const animatedHourSlotStyle = useAnimatedStyle(() => ({
        minHeight: hourHeightShared.value,
        gap: 8,
        position: "absolute",
        left: 0,
        right: 0,
    }));

    const animatedScheduleTasksStyle = useAnimatedStyle(() => ({
        height: 24 * hourHeightShared.value,
    }));

    const animatedPositionStyles = Array.from({ length: 24 }, (_, i) =>
        useAnimatedStyle(() => ({
            transform: [{ translateY: i * hourHeightShared.value }],
        }))
    );

    const animatedHourLineStyles = Array.from({ length: 24 }, (_, i) =>
        useAnimatedStyle(() => ({
            transform: [{ translateY: i * hourHeightShared.value }],
        }))
    );

    const createAnimatedPositionStyle = (hour: number) =>
        animatedPositionStyles[hour];
    const createAnimatedHourLineStyle = (hour: number) =>
        animatedHourLineStyles[hour];

    const currentTimeLineAnimatedStyle = useAnimatedStyle(() => {
        const now = new Date();
        const currentMinute = now.getMinutes();
        const position = (currentMinute / 60) * hourHeightShared.value;
        return {
            transform: [{ translateY: position }],
            opacity: 1,
        };
    });

    // Auto-scroll to first event
    useEffect(() => {
        if (
            tasksWithSpecificTime.length === 0 ||
            hasScrolledToFirstEvent.current
        ) {
            return;
        }

        let earliestHour = 24;
        tasksWithSpecificTime.forEach((task) => {
            let taskTime;
            if (task.startTime) taskTime = new Date(task.startTime);
            else if (task.startDate) taskTime = new Date(task.startDate);
            else if (task.deadline) taskTime = new Date(task.deadline);

            if (taskTime) {
                const hour = taskTime.getHours();
                if (hour < earliestHour) earliestHour = hour;
            }
        });

        if (earliestHour < 24) {
            const scrollPosition = Math.max(0, earliestHour - 1) * hourHeight;
            let rafId1: number;
            let rafId2: number;

            rafId1 = requestAnimationFrame(() => {
                rafId2 = requestAnimationFrame(() => {
                    if (scrollViewRef.current) {
                        scrollViewRef.current.scrollTo({
                            y: scrollPosition,
                            animated: true,
                        });
                        hasScrolledToFirstEvent.current = true;
                    }
                });
            });

            return () => {
                if (rafId1) cancelAnimationFrame(rafId1);
                if (rafId2) cancelAnimationFrame(rafId2);
            };
        }
    }, [tasksWithSpecificTime.length, scrollViewRef]);

    useEffect(() => {
        hasScrolledToFirstEvent.current = false;
    }, [selectedDate]);

    // Dismiss ghost on date change
    useEffect(() => {
        setGhostBlockVisible(false);
    }, [selectedDate]);

    // Context menu handlers — dismiss ghost block when opening context menu
    const handleLongPress = (task: any) => {
        setGhostBlockVisible(false);
        setSelectedTask(task);
        setContextMenuVisible(true);
    };

    const handleHideTask = async () => {
        if (!selectedTask?.id || !selectedTask?.categoryID) return;

        setIsHiding(true);
        try {
            updateTask(selectedTask.categoryID, selectedTask.id, {
                active: false,
            });
            await updateTaskAPI(selectedTask.categoryID, selectedTask.id, {
                content: selectedTask.content,
                priority: selectedTask.priority || 0,
                value: selectedTask.value || 0,
                public: selectedTask.public || false,
                recurring: selectedTask.recurring || false,
                recurDetails: selectedTask.recurDetails || {
                    every: 1,
                    behavior: "ROLLING",
                },
                active: false,
            });
            setContextMenuVisible(false);
        } catch (error) {
            logger.error("Failed to hide task", error);
            updateTask(selectedTask.categoryID, selectedTask.id, {
                active: true,
            });
        } finally {
            setIsHiding(false);
        }
    };

    const handleSeeMore = () => {
        setContextMenuVisible(false);
        if (selectedTask?.id) {
            router.push({
                pathname: "/(logged-in)/(tabs)/(task)/task/[id]",
                params: {
                    name: selectedTask.content,
                    id: selectedTask.id,
                    categoryId: selectedTask.categoryID || "",
                },
            });
        }
    };

    const handleGoToWorkspace = () => {
        setContextMenuVisible(false);
        if (selectedTask?.workspaceName) {
            setSelected(selectedTask.workspaceName);
            router.push("/(logged-in)/(tabs)/(task)/today");
        }
    };

    const handleDeleteTask = async () => {
        if (!selectedTask?.id || !selectedTask?.categoryID) return;

        const performDelete = async (deleteRecurring: boolean) => {
            setIsDeleting(true);
            try {
                await removeFromCategoryAPI(selectedTask.categoryID, selectedTask.id, deleteRecurring);
                removeFromCategory(selectedTask.categoryID, selectedTask.id);
                setContextMenuVisible(false);
            } catch (error) {
                logger.error("Failed to delete task", error);
            } finally {
                setIsDeleting(false);
            }
        };

        if (selectedTask.templateID) {
            setContextMenuVisible(false);
            Alert.alert(
                "Delete Recurring Task",
                "Do you want to delete only this task or all future tasks?",
                [
                    { text: "Cancel", style: "cancel" },
                    { text: "Only This Task", onPress: () => performDelete(false) },
                    { text: "All Future Tasks", onPress: () => performDelete(true), style: "destructive" },
                ]
            );
        } else {
            await performDelete(false);
        }
    };

    const handleCompleteTask = async () => {
        if (!selectedTask?.id || !selectedTask?.categoryID) return;

        setIsCompleting(true);
        try {
            await markAsCompletedAPI(selectedTask.categoryID, selectedTask.id, {
                timeCompleted: new Date().toISOString(),
                timeTaken: "PT0S",
            });
            removeFromCategory(selectedTask.categoryID, selectedTask.id);
            if (Platform.OS === "ios") {
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
            setContextMenuVisible(false);
        } catch (error) {
            logger.error("Failed to complete task", error);
        } finally {
            setIsCompleting(false);
        }
    };

    return (
        <View style={{ flex: 1 }}>
            <Animated.ScrollView
                ref={scrollViewRef}
                style={{ flex: 1 }}
                scrollEnabled={scrollEnabled}
                showsVerticalScrollIndicator={false}
                onScroll={useAnimatedScrollHandler({
                    onScroll: (event) => {
                        animatedScrollY.value = event.contentOffset.y;
                    },
                })}
                scrollEventThrottle={1}
                stickyHeaderIndices={[1]}
                contentContainerStyle={{ paddingBottom: 128 }}
            >
                <View>{headerContent}</View>

                <View style={{ backgroundColor: ThemedColor.background }}>
                    <View style={{ paddingBottom: 16, paddingHorizontal: 16 }}>
                        <UnscheduledTasksSection
                            tasks={tasksForTodayNoTime}
                            title="Today's Tasks"
                            description=""
                            collapsible
                            useSchedulable={false}
                            emptyMessage="No tasks without specific times"
                        />
                    </View>
                </View>

                {/* Schedule grid */}
                <View
                    style={[styles.scheduleSection, { paddingHorizontal: 16 }]}
                >
                    <GestureDetector gesture={composedGesture}>
                        <Animated.View style={animatedScheduleContentStyle}>
                            <View
                                style={{
                                    position: "absolute",
                                    top: 10,
                                    right: 10,
                                    backgroundColor: ThemedColor.primary,
                                    paddingHorizontal: 8,
                                    paddingVertical: 4,
                                    borderRadius: 12,
                                    opacity: isPinching ? 1 : 0,
                                    zIndex: 1000,
                                }}
                            >
                                <ThemedText
                                    type="caption"
                                    style={{
                                        color: ThemedColor.background,
                                        fontSize: 10,
                                    }}
                                >
                                    {hourHeight}px
                                </ThemedText>
                            </View>

                            <View style={styles.timeLabels}>
                                {Array.from({ length: 24 }, (_, i) => (
                                    <Animated.View
                                        key={i}
                                        style={[
                                            animatedTimeLabelStyle,
                                            createAnimatedPositionStyle(i),
                                            { position: "absolute" },
                                        ]}
                                    >
                                        <ThemedText
                                            type="caption"
                                            style={styles.timeText}
                                        >
                                            {`${i === 0 ? 12 : i > 12 ? i - 12 : i} ${i >= 12 ? "PM" : "AM"}`}
                                        </ThemedText>
                                    </Animated.View>
                                ))}
                            </View>

                            <View style={styles.hourLines}>
                                {Array.from({ length: 24 }, (_, i) => (
                                    <Animated.View
                                        key={`line-${i}`}
                                        style={[
                                            themedStyles.hourLine,
                                            createAnimatedHourLineStyle(i),
                                            { position: "absolute" },
                                        ]}
                                    />
                                ))}
                            </View>

                            <Animated.View
                                style={[
                                    styles.scheduleTasks,
                                    animatedScheduleTasksStyle,
                                ]}
                            >
                                {Array.from({ length: 24 }, (_, i) => {
                                    const hour = i;
                                    const tasksInThisHour =
                                        tasksWithSpecificTime.filter((task) => {
                                            let taskTime;
                                            if (task.startTime)
                                                taskTime = new Date(
                                                    task.startTime
                                                );
                                            else if (task.startDate)
                                                taskTime = new Date(
                                                    task.startDate
                                                );
                                            else if (task.deadline)
                                                taskTime = new Date(
                                                    task.deadline
                                                );
                                            else return false;
                                            return (
                                                taskTime.getHours() === hour
                                            );
                                        });

                                    const now = new Date();
                                    const shouldShowCurrentTime =
                                        hour === now.getHours() &&
                                        isSameDay(selectedDate, now);

                                    return (
                                        <Animated.View
                                            key={hour}
                                            style={[
                                                animatedHourSlotStyle,
                                                createAnimatedPositionStyle(
                                                    hour
                                                ),
                                                { position: "absolute" },
                                            ]}
                                        >
                                            {shouldShowCurrentTime && (
                                                <Animated.View
                                                    ref={currentTimeLineRef}
                                                    style={[
                                                        themedStyles.currentTimeLine,
                                                        currentTimeLineAnimatedStyle,
                                                    ]}
                                                >
                                                    <View
                                                        style={
                                                            themedStyles.currentTimeIndicator
                                                        }
                                                    />
                                                </Animated.View>
                                            )}
                                            {tasksInThisHour.map(
                                                (task, index, array) => {
                                                    if (!task) return null;
                                                    const isDeadline =
                                                        task.deadline &&
                                                        !task.startTime &&
                                                        !task.startDate;
                                                    let durationHours = 1;
                                                    let minuteOffset = 0;

                                                    if (
                                                        task.startTime &&
                                                        task.deadline
                                                    ) {
                                                        const st = new Date(
                                                            task.startTime
                                                        );
                                                        const et = new Date(
                                                            task.deadline
                                                        );
                                                        durationHours =
                                                            Math.min(
                                                                8,
                                                                (et.getTime() -
                                                                    st.getTime()) /
                                                                    3600000
                                                            );
                                                        minuteOffset =
                                                            st.getMinutes();
                                                    } else if (
                                                        task.startTime
                                                    ) {
                                                        minuteOffset =
                                                            new Date(
                                                                task.startTime
                                                            ).getMinutes();
                                                    } else if (
                                                        task.startDate &&
                                                        !isDeadline
                                                    ) {
                                                        minuteOffset =
                                                            new Date(
                                                                task.startDate
                                                            ).getMinutes();
                                                    }

                                                    return (
                                                        <CalendarEventCard
                                                            key={
                                                                task.id ||
                                                                `task-${Math.random()}`
                                                            }
                                                            task={task}
                                                            hourHeightShared={
                                                                hourHeightShared
                                                            }
                                                            durationHours={
                                                                durationHours
                                                            }
                                                            minuteOffset={
                                                                minuteOffset
                                                            }
                                                            widthPercent={
                                                                100 /
                                                                array.length
                                                            }
                                                            leftPercent={
                                                                index *
                                                                (100 /
                                                                    array.length)
                                                            }
                                                            onLongPress={
                                                                handleLongPress
                                                            }
                                                        />
                                                    );
                                                }
                                            )}
                                        </Animated.View>
                                    );
                                })}

                                {/* Interactive ghost block */}
                                {ghostBlockVisible && (
                                    <TimeRangeGhostBlock
                                        startMinutes={ghostStartMinutes}
                                        endMinutes={ghostEndMinutes}
                                        hourHeightShared={hourHeightShared}
                                        timeLabel={ghostTimeLabel}
                                        onConfirm={handleGhostConfirm}
                                        onTimeLabelUpdate={updateGhostLabel}
                                    />
                                )}
                            </Animated.View>
                        </Animated.View>
                    </GestureDetector>
                </View>

                <View style={{ paddingHorizontal: 16 }}>
                    <UnscheduledTasksSection
                        tasks={tasksUnscheduled}
                        title="Unscheduled Tasks"
                        description="These are tasks that don't have a start date or deadline. Swipe right to schedule for this day."
                        useSchedulable={true}
                        onScheduleTask={(task, type) =>
                            logger.debug("Scheduling task", {
                                taskContent: task.content,
                                type,
                            })
                        }
                        schedulingType="startDate"
                        emptyMessage="No unscheduled tasks"
                    />
                </View>
            </Animated.ScrollView>

            <DefaultModal
                visible={contextMenuVisible}
                setVisible={setContextMenuVisible}
                enableDynamicSizing={true}
                enablePanDownToClose={true}
            >
                <View style={{ paddingBottom: 16 }}>
                    <ThemedText
                        type="subtitle"
                        style={{ marginBottom: 16, paddingHorizontal: 4 }}
                    >
                        {selectedTask?.content}
                    </ThemedText>

                    <TouchableOpacity
                        style={[styles.menuOption, { borderTopWidth: 0 }]}
                        onPress={handleSeeMore}
                    >
                        <Ionicons
                            name="information-circle-outline"
                            size={24}
                            color={ThemedColor.text}
                        />
                        <ThemedText
                            type="default"
                            style={{ marginLeft: 12, flex: 1 }}
                        >
                            See More
                        </ThemedText>
                        <Ionicons
                            name="chevron-forward"
                            size={20}
                            color={ThemedColor.caption}
                        />
                    </TouchableOpacity>

                    {selectedTask?.workspaceName && (
                        <TouchableOpacity
                            style={styles.menuOption}
                            onPress={handleGoToWorkspace}
                        >
                            <Ionicons
                                name="folder-outline"
                                size={24}
                                color={ThemedColor.text}
                            />
                            <View style={{ marginLeft: 12, flex: 1 }}>
                                <ThemedText type="default">
                                    Go to Workspace
                                </ThemedText>
                                <ThemedText
                                    type="caption"
                                    style={{ fontSize: 12, marginTop: 2 }}
                                >
                                    {selectedTask.workspaceName}
                                </ThemedText>
                            </View>
                            <Ionicons
                                name="chevron-forward"
                                size={20}
                                color={ThemedColor.caption}
                            />
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity
                        style={styles.menuOption}
                        onPress={handleCompleteTask}
                        disabled={isCompleting}
                    >
                        <Ionicons
                            name="checkmark-circle-outline"
                            size={24}
                            color={
                                isCompleting
                                    ? ThemedColor.caption
                                    : ThemedColor.tint
                            }
                        />
                        <ThemedText
                            type="default"
                            style={{
                                marginLeft: 12,
                                flex: 1,
                                color: isCompleting
                                    ? ThemedColor.caption
                                    : ThemedColor.tint,
                            }}
                        >
                            {isCompleting
                                ? "Completing..."
                                : "Mark as Complete"}
                        </ThemedText>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.menuOption}
                        onPress={handleHideTask}
                        disabled={isHiding}
                    >
                        <Ionicons
                            name="eye-off-outline"
                            size={24}
                            color={
                                isHiding
                                    ? ThemedColor.caption
                                    : ThemedColor.error
                            }
                        />
                        <ThemedText
                            type="default"
                            style={{
                                marginLeft: 12,
                                flex: 1,
                                color: isHiding
                                    ? ThemedColor.caption
                                    : ThemedColor.error,
                            }}
                        >
                            {isHiding ? "Hiding..." : "Hide Task"}
                        </ThemedText>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.menuOption}
                        onPress={handleDeleteTask}
                        disabled={isDeleting}
                    >
                        <Ionicons
                            name="trash-outline"
                            size={24}
                            color={
                                isDeleting
                                    ? ThemedColor.caption
                                    : ThemedColor.error
                            }
                        />
                        <ThemedText
                            type="default"
                            style={{
                                marginLeft: 12,
                                flex: 1,
                                color: isDeleting
                                    ? ThemedColor.caption
                                    : ThemedColor.error,
                            }}
                        >
                            {isDeleting ? "Deleting..." : "Delete Task"}
                        </ThemedText>
                    </TouchableOpacity>
                </View>
            </DefaultModal>
        </View>
    );
};

const styles = StyleSheet.create({
    scheduleSection: {
        marginBottom: 24,
    },
    timeLabels: {
        width: TIME_LABEL_WIDTH,
        position: "absolute",
        left: 0,
        top: 0,
        height: "100%",
    },
    hourLines: {
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        height: "100%",
        zIndex: 1,
    },
    timeText: {
        fontSize: 12,
    },
    scheduleTasks: {
        flex: 1,
        position: "absolute",
        left: TIME_LABEL_WIDTH + 8,
        right: 0,
        top: 0,
        zIndex: 3,
    },
    menuOption: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 16,
        paddingHorizontal: 4,
        borderTopWidth: 1,
        borderTopColor: "rgba(128, 128, 128, 0.2)",
    },
});

export const CalendarView = CalendarViewComponent;
