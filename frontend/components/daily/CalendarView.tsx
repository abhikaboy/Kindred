import React, { useState, useRef, useEffect } from "react";
import { View, TouchableOpacity, StyleSheet, Pressable } from "react-native";
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
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import UnscheduledTasksSection from "@/components/task/UnscheduledTasksSection";
import { getCategoryDuotoneColors } from "@/utils/categoryColors";
import DefaultModal from "@/components/modals/DefaultModal";
import { Ionicons } from "@expo/vector-icons";
import { useTasks } from "@/contexts/tasksContext";
import { updateTaskAPI } from "@/api/task";
import { CalendarEventCard } from "./CalendarEventCard";
import { logger } from "@/utils/logger";

const TIME_LABEL_WIDTH = 40;

interface CalendarViewProps {
    selectedDate: Date;
    tasksWithSpecificTime: any[];
    tasksForTodayNoTime: any[];
    tasksUnscheduled: any[];
    animatedScrollY: SharedValue<number>;
    scrollViewRef: AnimatedRef<Animated.ScrollView>;
    headerContent?: React.ReactNode;
}

const CalendarViewComponent: React.FC<CalendarViewProps> = ({
    selectedDate,
    tasksWithSpecificTime,
    tasksForTodayNoTime,
    tasksUnscheduled,
    animatedScrollY,
    scrollViewRef,
    headerContent,
}) => {
    const ThemedColor = useThemeColor();
    const { setSelected, updateTask } = useTasks();
    const currentTimeLineRef = useRef<View>(null);
    const hasScrolledToFirstEvent = useRef(false);

    // Context menu state
    const [contextMenuVisible, setContextMenuVisible] = useState(false);
    const [selectedTask, setSelectedTask] = useState<any>(null);
    const [isHiding, setIsHiding] = useState(false);

    // Shared values for pinch gesture
    const hourHeightShared = useSharedValue(60);
    const [hourHeight, setHourHeight] = useState(60);
    const initialPinchHeightShared = useSharedValue(60);
    const initialScrollPositionShared = useSharedValue(0);
    const focalPointYShared = useSharedValue(0);
    const isPinchingShared = useSharedValue(false);
    const [isPinching, setIsPinching] = useState(false);

    // Use animated reaction to watch for height changes and update scroll position
    useAnimatedReaction(
        () => hourHeightShared.value,
        (currentHeight, previousHeight) => {
            if (isPinchingShared.value && previousHeight !== null) {
                const scale = currentHeight / initialPinchHeightShared.value;
                const initialScrollY = initialScrollPositionShared.value;
                const focalOffsetY = focalPointYShared.value;

                const contentAtFocal = initialScrollY + focalOffsetY;
                const newScrollY = contentAtFocal * scale - focalOffsetY;
                const clampedScrollY = Math.max(0, newScrollY);

                scrollTo(scrollViewRef, 0, clampedScrollY, false);
            }
        }
    );

    // Pinch Gesture
    const pinchGesture = Gesture.Pinch()
        .onBegin((event) => {
            initialPinchHeightShared.value = hourHeightShared.value;
            focalPointYShared.value = event.focalY - 200; // Approximate offset adjustment if needed, or relative to container
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

    // Styles
    const themedStyles = StyleSheet.create({
        currentTimeLine: {
            position: "absolute",
            left: 0,
            right: 0,
            height: 3,
            backgroundColor: '#ef4444', // Red color
            zIndex: 10,
            shadowColor: '#ef4444',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.5,
            shadowRadius: 3,
        },
        currentTimeIndicator: {
            width: 14,
            height: 14,
            borderRadius: 7,
            backgroundColor: '#ef4444', // Red color
            position: "absolute",
            top: -6,
            left: -7,
            zIndex: 11,
            borderWidth: 2,
            borderColor: '#ffffff',
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
        useAnimatedStyle(() => ({ transform: [{ translateY: i * hourHeightShared.value }] }))
    );

    const animatedHourLineStyles = Array.from({ length: 24 }, (_, i) =>
        useAnimatedStyle(() => ({ transform: [{ translateY: i * hourHeightShared.value }] }))
    );

    const createAnimatedPositionStyle = (hour: number) => animatedPositionStyles[hour];
    const createAnimatedHourLineStyle = (hour: number) => animatedHourLineStyles[hour];

    const currentTimeLineAnimatedStyle = useAnimatedStyle(() => {
        const now = new Date();
        const currentMinute = now.getMinutes();
        const position = (currentMinute / 60) * hourHeightShared.value;
        return {
            transform: [{ translateY: position }],
            opacity: 1,
        };
    });

    // Auto-scroll to first event on mount or when date changes
    useEffect(() => {
        if (tasksWithSpecificTime.length === 0 || hasScrolledToFirstEvent.current) {
            return;
        }

        // Find the earliest task
        let earliestHour = 24;
        tasksWithSpecificTime.forEach((task) => {
            let taskTime;
            if (task.startTime) {
                taskTime = new Date(task.startTime);
            } else if (task.startDate) {
                taskTime = new Date(task.startDate);
            } else if (task.deadline) {
                taskTime = new Date(task.deadline);
            }

            if (taskTime) {
                const hour = taskTime.getHours();
                if (hour < earliestHour) {
                    earliestHour = hour;
                }
            }
        });

        // Scroll to the earliest event with some padding (1 hour before)
        if (earliestHour < 24) {
            const scrollToHour = Math.max(0, earliestHour - 1);
            const scrollPosition = scrollToHour * hourHeight;

            // Use requestAnimationFrame to ensure the layout is ready
            let rafId1: number;
            let rafId2: number;

            rafId1 = requestAnimationFrame(() => {
                rafId2 = requestAnimationFrame(() => {
                    if (scrollViewRef.current) {
                        scrollViewRef.current.scrollTo({ y: scrollPosition, animated: true });
                        hasScrolledToFirstEvent.current = true;
                    }
                });
            });

            // Cleanup function to cancel pending animation frames
            return () => {
                if (rafId1) cancelAnimationFrame(rafId1);
                if (rafId2) cancelAnimationFrame(rafId2);
            };
        }
    }, [tasksWithSpecificTime.length, scrollViewRef]);

    // Reset scroll flag when date changes
    useEffect(() => {
        hasScrolledToFirstEvent.current = false;
    }, [selectedDate]);

    // Context menu handlers
    const handleLongPress = (task: any) => {
        setSelectedTask(task);
        setContextMenuVisible(true);
    };

    const handleHideTask = async () => {
        if (!selectedTask?.id || !selectedTask?.categoryID) {
            return;
        }

        setIsHiding(true);

        try {
            // Optimistically update the UI
            updateTask(selectedTask.categoryID, selectedTask.id, { active: false });

            // Make API call to persist the change
            await updateTaskAPI(selectedTask.categoryID, selectedTask.id, {
                content: selectedTask.content,
                priority: selectedTask.priority || 0,
                value: selectedTask.value || 0,
                public: selectedTask.public || false,
                recurring: selectedTask.recurring || false,
                recurDetails: selectedTask.recurDetails || { every: 1, behavior: "ROLLING" },
                active: false, // Set task as inactive (hidden)
            });

            setContextMenuVisible(false);
        } catch (error) {
            logger.error("Failed to hide task", error);
            // Revert the optimistic update on error
            updateTask(selectedTask.categoryID, selectedTask.id, { active: true });
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
            // Set the selected workspace in context
            setSelected(selectedTask.workspaceName);
            // Navigate to the today/workspace view
            router.push("/(logged-in)/(tabs)/(task)/today");
        }
    };

    return (
        <View style={{ flex: 1 }}>
            <Animated.ScrollView
                ref={scrollViewRef}
                style={{ flex: 1 }}
                showsVerticalScrollIndicator={false}
                onScroll={useAnimatedScrollHandler({
                    onScroll: (event) => {
                        animatedScrollY.value = event.contentOffset.y;
                    },
                })}
                scrollEventThrottle={1}
                stickyHeaderIndices={[1]} // Stick the second child (Today's Tasks)
                contentContainerStyle={{ paddingBottom: 128 }}
            >
                {/* Child 0: Header Content */}
                <View>
                    {headerContent}
                </View>

                {/* Child 1: Today's Tasks - Sticky Header */}
                <View style={{ backgroundColor: ThemedColor.background }}>
                    <View style={{ paddingBottom: 16, paddingHorizontal: 16 }}>
                        <UnscheduledTasksSection
                            tasks={tasksForTodayNoTime}
                            title="Today's Tasks"
                            description=""
                            useSchedulable={false}
                            emptyMessage="No tasks without specific times"
                        />
                    </View>
                </View>

                {/* Child 2: Schedule */}
                <View style={[styles.scheduleSection, { paddingHorizontal: 16 }]}>
                    <GestureDetector gesture={pinchGesture}>
                        <Animated.View style={animatedScheduleContentStyle}>
                            <View style={{
                                position: "absolute",
                                top: 10,
                                right: 10,
                                backgroundColor: ThemedColor.primary,
                                paddingHorizontal: 8,
                                paddingVertical: 4,
                                borderRadius: 12,
                                opacity: isPinching ? 1 : 0,
                                zIndex: 1000,
                            }}>
                                <ThemedText type="caption" style={{ color: ThemedColor.background, fontSize: 10 }}>
                                    {hourHeight}px
                                </ThemedText>
                            </View>

                            <View style={styles.timeLabels}>
                                {Array.from({ length: 24 }, (_, i) => {
                                    const hour = i;
                                    return (
                                        <Animated.View
                                            key={hour}
                                            style={[
                                                animatedTimeLabelStyle,
                                                createAnimatedPositionStyle(hour),
                                                { position: "absolute" },
                                            ]}>
                                            <ThemedText type="caption" style={styles.timeText}>
                                                {`${hour === 0 ? 12 : hour > 12 ? hour - 12 : hour} ${hour >= 12 ? "PM" : "AM"}`}
                                            </ThemedText>
                                        </Animated.View>
                                    );
                                })}
                            </View>

                            <View style={styles.hourLines}>
                                {Array.from({ length: 24 }, (_, i) => {
                                    const hour = i;
                                    return (
                                        <Animated.View
                                            key={`line-${hour}`}
                                            style={[
                                                themedStyles.hourLine,
                                                createAnimatedHourLineStyle(hour),
                                                { position: "absolute" },
                                            ]}
                                        />
                                    );
                                })}
                            </View>
                            <Animated.View style={[styles.scheduleTasks, animatedScheduleTasksStyle]}>
                                {Array.from({ length: 24 }, (_, i) => {
                                    const hour = i;
                                    const tasksInThisHour = tasksWithSpecificTime.filter((task) => {
                                        let taskTime;
                                        if (task.startTime) {
                                            taskTime = new Date(task.startTime);
                                        } else if (task.startDate) {
                                            taskTime = new Date(task.startDate);
                                        } else if (task.deadline) {
                                            taskTime = new Date(task.deadline);
                                        } else {
                                            return false;
                                        }
                                        return taskTime.getHours() === hour;
                                    });

                                    const now = new Date();
                                    const isCurrentHour = hour === now.getHours();
                                    const isToday = isSameDay(selectedDate, now);
                                    const shouldShowCurrentTime = isCurrentHour && isToday;

                                    return (
                                        <Animated.View
                                            key={hour}
                                            style={[
                                                animatedHourSlotStyle,
                                                createAnimatedPositionStyle(hour),
                                                { position: "absolute" },
                                            ]}>
                                            {shouldShowCurrentTime && (
                                                <Animated.View
                                                    ref={currentTimeLineRef}
                                                    style={[
                                                        themedStyles.currentTimeLine,
                                                        currentTimeLineAnimatedStyle,
                                                    ]}>
                                                    <View style={themedStyles.currentTimeIndicator} />
                                                </Animated.View>
                                            )}
                                            {tasksInThisHour.map((task, index, array) => {
                                                if (!task) return null;
                                                const isDeadline = task.deadline && !task.startTime && !task.startDate;
                                                let durationHours = 1;
                                                let minuteOffset = 0;

                                                if (task.startTime && task.deadline) {
                                                    const startTime = new Date(task.startTime);
                                                    const endTime = new Date(task.deadline);
                                                    const durationMs = endTime.getTime() - startTime.getTime();
                                                    durationHours = Math.max(0.5, Math.min(8, durationMs / (1000 * 60 * 60)));
                                                    minuteOffset = startTime.getMinutes();
                                                } else if (task.startTime) {
                                                    const startTime = new Date(task.startTime);
                                                    minuteOffset = startTime.getMinutes();
                                                } else if (task.startDate && !isDeadline) {
                                                    const startTime = new Date(task.startDate);
                                                    minuteOffset = startTime.getMinutes();
                                                }

                                                // Handle overlaps by splitting width
                                                const widthPercent = 100 / array.length;
                                                const leftPercent = index * widthPercent;

                                                return (
                                                    <CalendarEventCard
                                                        key={task.id || `task-${Math.random()}`}
                                                        task={task}
                                                        hourHeightShared={hourHeightShared}
                                                        durationHours={durationHours}
                                                        minuteOffset={minuteOffset}
                                                        widthPercent={widthPercent}
                                                        leftPercent={leftPercent}
                                                        onLongPress={handleLongPress}
                                                    />
                                                );
                                            })}
                                        </Animated.View>
                                    );
                                })}
                            </Animated.View>
                        </Animated.View>
                    </GestureDetector>
                </View>

                {/* Child 3: Unscheduled Tasks (Bottom) */}
                <View style={{ paddingHorizontal: 16 }}>
                    <UnscheduledTasksSection
                        tasks={tasksUnscheduled}
                        title="Unscheduled Tasks"
                        description="These are tasks that don't have a start date or deadline. Swipe right to schedule for this day."
                        useSchedulable={true}
                        onScheduleTask={(task, type) => logger.debug("Scheduling task", { taskContent: task.content, type })}
                        schedulingType="startDate"
                        emptyMessage="No unscheduled tasks"
                    />
                </View>
            </Animated.ScrollView>

            {/* Context Menu Modal */}
            <DefaultModal
                visible={contextMenuVisible}
                setVisible={setContextMenuVisible}
                enableDynamicSizing={true}
                enablePanDownToClose={true}
            >
                <View style={{ paddingBottom: 16 }}>
                    <ThemedText type="subtitle" style={{ marginBottom: 16, paddingHorizontal: 4 }}>
                        {selectedTask?.content}
                    </ThemedText>

                    {/* See More Option */}
                    <TouchableOpacity
                        style={[styles.menuOption, { borderTopWidth: 0 }]}
                        onPress={handleSeeMore}
                    >
                        <Ionicons name="information-circle-outline" size={24} color={ThemedColor.text} />
                        <ThemedText type="default" style={{ marginLeft: 12, flex: 1 }}>
                            See More
                        </ThemedText>
                        <Ionicons name="chevron-forward" size={20} color={ThemedColor.caption} />
                    </TouchableOpacity>

                    {/* Go to Workspace Option */}
                    {selectedTask?.workspaceName && (
                        <TouchableOpacity
                            style={styles.menuOption}
                            onPress={handleGoToWorkspace}
                        >
                            <Ionicons name="folder-outline" size={24} color={ThemedColor.text} />
                            <View style={{ marginLeft: 12, flex: 1 }}>
                                <ThemedText type="default">Go to Workspace</ThemedText>
                                <ThemedText type="caption" style={{ fontSize: 12, marginTop: 2 }}>
                                    {selectedTask.workspaceName}
                                </ThemedText>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={ThemedColor.caption} />
                        </TouchableOpacity>
                    )}

                    {/* Hide Option */}
                    <TouchableOpacity
                        style={styles.menuOption}
                        onPress={handleHideTask}
                        disabled={isHiding}
                    >
                        <Ionicons
                            name="eye-off-outline"
                            size={24}
                            color={isHiding ? ThemedColor.caption : ThemedColor.error}
                        />
                        <ThemedText
                            type="default"
                            style={{
                                marginLeft: 12,
                                flex: 1,
                                color: isHiding ? ThemedColor.caption : ThemedColor.error
                            }}
                        >
                            {isHiding ? "Hiding..." : "Hide Task"}
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

// Memoize CalendarView to prevent unnecessary re-renders when hidden
export const CalendarView = React.memo(CalendarViewComponent, (prevProps, nextProps) => {
    // Only re-render if these specific props change
    // Use length comparison for arrays since useMemo should keep reference stable
    const sameDate = prevProps.selectedDate.getTime() === nextProps.selectedDate.getTime();
    const sameTasksWithTime = prevProps.tasksWithSpecificTime.length === nextProps.tasksWithSpecificTime.length;
    const sameTodayTasks = prevProps.tasksForTodayNoTime.length === nextProps.tasksForTodayNoTime.length;
    const sameUnscheduled = prevProps.tasksUnscheduled.length === nextProps.tasksUnscheduled.length;

    return sameDate && sameTasksWithTime && sameTodayTasks && sameUnscheduled;
});
