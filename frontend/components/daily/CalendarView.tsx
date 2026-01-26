import React, { useState, useRef } from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
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
    const currentTimeLineRef = useRef<View>(null);

    // Shared values for pinch gesture
    const hourHeightShared = useSharedValue(40);
    const [hourHeight, setHourHeight] = useState(40);
    const initialPinchHeightShared = useSharedValue(40);
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
            const clampedHeight = Math.max(20, Math.min(80, newHeight));
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
        scheduleTaskContent: {
            height: "100%",
            maxHeight: "100%",
            overflow: "hidden",
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: ThemedColor.text,
            justifyContent: "center",
            backgroundColor: ThemedColor.lightened,
        },
        deadlineTaskContent: {
            borderColor: ThemedColor.error,
            backgroundColor: ThemedColor.error,
        },
        deadlineText: {
            color: ThemedColor.background,
        },
        currentTimeLine: {
            position: "absolute",
            left: 0,
            right: 0,
            height: 2,
            backgroundColor: ThemedColor.primary,
            zIndex: 10,
        },
        currentTimeIndicator: {
            width: 12,
            height: 12,
            borderRadius: 6,
            backgroundColor: ThemedColor.primary,
            position: "absolute",
            top: -5,
            left: -6,
            zIndex: 11,
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
        justifyContent: "center",
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

    const createTaskStyle = (durationHours: number, minuteOffset: number = 0) => {
        const currentHourHeight = hourHeight;
        const proportionalHeight = durationHours * currentHourHeight * 0.85;
        const taskHeight = proportionalHeight;
        const topOffset = (minuteOffset / 60) * currentHourHeight;

        return {
            height: taskHeight,
            maxHeight: taskHeight,
            overflow: "hidden" as const,
            top: topOffset,
        };
    };

    const animatedScheduleTasksStyle = useAnimatedStyle(() => ({
        height: 24 * hourHeightShared.value,
    }));

    const animatedPositionStyles = Array.from({ length: 24 }, (_, i) => 
        useAnimatedStyle(() => ({ transform: [{ translateY: i * hourHeightShared.value }] }))
    );

    const animatedHourLineStyles = Array.from({ length: 24 }, (_, i) => 
        useAnimatedStyle(() => ({ transform: [{ translateY: i * hourHeightShared.value + hourHeightShared.value / 2 }] }))
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

                                                const taskStyle = createTaskStyle(durationHours, minuteOffset);
                                                
                                                // Handle overlaps by splitting width
                                                const widthPercent = 100 / array.length;
                                                const leftPercent = index * widthPercent;

                                                return (
                                                    <View 
                                                        key={task.id || `task-${Math.random()}`} 
                                                        style={[
                                                            taskStyle, 
                                                            { 
                                                                position: "absolute", 
                                                                width: `${widthPercent}%`,
                                                                left: `${leftPercent}%`
                                                            }
                                                        ]}
                                                    >
                                                        <TouchableOpacity
                                                            style={styles.scheduleTaskTouchable}
                                                            onPress={() => {
                                                                if (task.id) {
                                                                    router.push({
                                                                        pathname: "/(logged-in)/(tabs)/(task)/task/[id]",
                                                                        params: {
                                                                            name: task.content,
                                                                            id: task.id,
                                                                            categoryId: task.categoryID || "",
                                                                        },
                                                                    });
                                                                }
                                                            }}>
                                                            <View style={[
                                                                themedStyles.scheduleTaskContent,
                                                                isDeadline && themedStyles.deadlineTaskContent,
                                                            ]}>
                                                                <ThemedText type="lightBody" style={isDeadline && themedStyles.deadlineText}>
                                                                    {isDeadline ? `${task.content} [Deadline]` : task.content}
                                                                </ThemedText>
                                                            </View>
                                                        </TouchableOpacity>
                                                    </View>
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
                        onScheduleTask={(task, type) => console.log("Scheduling task:", task.content, "as:", type)}
                        schedulingType="startDate"
                        emptyMessage="No unscheduled tasks"
                    />
                </View>
            </Animated.ScrollView>
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
    scheduleTaskTouchable: {
        flex: 1,
        width: "100%",
        height: "100%",
        overflow: "hidden",
    },
});

// Memoize CalendarView to prevent unnecessary re-renders when hidden
export const CalendarView = React.memo(CalendarViewComponent, (prevProps, nextProps) => {
    // Only re-render if these specific props change
    return (
        prevProps.selectedDate.getTime() === nextProps.selectedDate.getTime() &&
        prevProps.tasksWithSpecificTime === nextProps.tasksWithSpecificTime &&
        prevProps.tasksForTodayNoTime === nextProps.tasksForTodayNoTime &&
        prevProps.tasksUnscheduled === nextProps.tasksUnscheduled
        // Note: We don't compare animatedScrollY, scrollViewRef, or headerContent as they're refs/nodes
    );
});
