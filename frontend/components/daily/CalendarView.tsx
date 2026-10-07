import React, { useState, useRef, useEffect, useMemo, useCallback, forwardRef, useImperativeHandle } from "react";
import { View, TouchableOpacity, StyleSheet, ScrollView, useColorScheme } from "react-native";
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
import { clampWindowToDay } from "@/utils/taskCountsByDay";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import * as Haptics from "expo-haptics";
import { hapticCompletionBurst } from "@/utils/haptics";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import DefaultModal from "@/components/modals/DefaultModal";
import { Plus, CaretRight, Info, Folder, CheckCircle, EyeSlash, Trash } from "phosphor-react-native";
import { useTasks } from "@/contexts/tasksContext";
import { updateTaskAPI, markAsCompletedAPI } from "@/api/task";
import { Task } from "@/api/types";
import { useUndoableDelete } from "@/hooks/useUndoableDelete";
import { CalendarEventCard } from "./CalendarEventCard";
import { TimeRangeGhostBlock } from "./TimeRangeGhostBlock";
import { useDailyTasks } from "@/hooks/useDailyTasks";
import { isInPlan } from "@/utils/waitingCandidate";
import { formatMinutesToTime } from "@/utils/timeUtils";
import { getCategoryDuotoneColors } from "@/utils/categoryColors";
import { logger } from "@/utils/logger";
import { useQueryClient } from "@tanstack/react-query";

const TIME_LABEL_WIDTH = 40;
const DEFAULT_BLOCK_MINUTES = 30;

export interface ScheduleTimeRange {
    startMinutes: number;
    endMinutes: number;
}

export interface CalendarViewHandle {
    clearGhost: () => void;
}

interface CalendarViewProps {
    selectedDate: Date;
    animatedScrollY: SharedValue<number>;
    scrollViewRef: AnimatedRef<Animated.ScrollView>;
    headerContent?: React.ReactNode;
    onGhostRangeChange?: (range: ScheduleTimeRange | null) => void;
    /** Space to leave under the grid for floating chrome (tray, tab bar). */
    bottomInset?: number;
    /** Creates an untimed task on this day. */
    onAddAllDay?: () => void;
}

const CalendarViewComponent = forwardRef<CalendarViewHandle, CalendarViewProps>(
    (
        {
            selectedDate,
            animatedScrollY,
            scrollViewRef,
            headerContent,
            onGhostRangeChange,
            bottomInset = 128,
            onAddAllDay,
        },
        ref
    ) => {
        const ThemedColor = useThemeColor();
        const { setSelected, updateTask, removeFromCategory, addToCategory } = useTasks();
        const scheme = useColorScheme() === "dark" ? "dark" : "light";
        const queryClient = useQueryClient();
        const {
            tasksWithSpecificTime: realTimed,
            tasksForTodayNoTime: realAllDay,
            projectedForSelectedDate,
        } = useDailyTasks(selectedDate);
        // Projected recurrences sit alongside real tasks but open their source instead of the menu
        const tasksWithSpecificTime = useMemo(
            // Planned steps render in the header as a step card with Start, so skip them here
            () => [...realTimed.filter((t) => !isInPlan(t)), ...projectedForSelectedDate.filter((t) => t.startTime)],
            [realTimed, projectedForSelectedDate]
        );
        const tasksForTodayNoTime = useMemo(
            () => [...realAllDay.filter((t) => !isInPlan(t)), ...projectedForSelectedDate.filter((t) => !t.startTime)],
            [realAllDay, projectedForSelectedDate]
        );
        const { deleteWithUndo, alertElement } = useUndoableDelete();
        const currentTimeLineRef = useRef<View>(null);
        const hasScrolledToFirstEvent = useRef(false);

        // Context menu state
        const [contextMenuVisible, setContextMenuVisible] = useState(false);
        const [selectedTask, setSelectedTask] = useState<any>(null);
        const [isHiding, setIsHiding] = useState(false);
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

        // Held in a ref so the dismiss/label callbacks stay stable across renders
        const onGhostRangeChangeRef = useRef(onGhostRangeChange);
        useEffect(() => {
            onGhostRangeChangeRef.current = onGhostRangeChange;
        }, [onGhostRangeChange]);

        // Shared values for pinch gesture
        const hourHeightShared = useSharedValue(60);
        const [hourHeight, setHourHeight] = useState(60);
        const initialPinchHeightShared = useSharedValue(60);
        const initialScrollPositionShared = useSharedValue(0);
        const focalPointYShared = useSharedValue(0);
        const isPinchingShared = useSharedValue(false);
        const [isPinching, setIsPinching] = useState(false);

        const scrollEnabled = !ghostBlockVisible;
        const scrollHandler = useAnimatedScrollHandler({
            onScroll: (event) => {
                animatedScrollY.value = event.contentOffset.y;
            },
        });

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

        const updateGhostLabel = useCallback((startMins: number, endMins: number) => {
            setGhostTimeLabel(`${formatMinutesToTime(startMins)} - ${formatMinutesToTime(endMins)}`);
            onGhostRangeChangeRef.current?.({
                startMinutes: startMins,
                endMinutes: endMins,
            });
        }, []);

        const showGhostBlock = useCallback(
            (y: number) => {
                const rawMinutes = (y / hourHeightShared.value) * 60;
                const snapped = Math.max(0, Math.min(1440 - DEFAULT_BLOCK_MINUTES, Math.round(rawMinutes / 15) * 15));
                const endMins = Math.min(1440, snapped + DEFAULT_BLOCK_MINUTES);

                ghostStartMinutes.value = snapped;
                ghostEndMinutes.value = endMins;
                setGhostTimeLabel(`${formatMinutesToTime(snapped)} - ${formatMinutesToTime(endMins)}`);
                setGhostBlockVisible(true);
                ghostBlockVisibleRef.current = true;
                onGhostRangeChangeRef.current?.({
                    startMinutes: snapped,
                    endMinutes: endMins,
                });
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            },
            [hourHeightShared]
        );

        const handleGhostDismiss = useCallback(() => {
            if (!ghostBlockVisibleRef.current) return;
            ghostBlockVisibleRef.current = false;
            setGhostBlockVisible(false);
            onGhostRangeChangeRef.current?.(null);
        }, []);

        useImperativeHandle(ref, () => ({ clearGhost: handleGhostDismiss }), [handleGhostDismiss]);

        const handleGridTapJS = useCallback(
            (y: number) => {
                if (ghostBlockVisibleRef.current) {
                    // A tap inside the ghost is a no-op; outside dismisses it
                    const topPx = (ghostStartMinutes.value / 60) * hourHeightShared.value;
                    const bottomPx = (ghostEndMinutes.value / 60) * hourHeightShared.value;
                    if (y < topPx - 12 || y > bottomPx + 12) {
                        handleGhostDismiss();
                    }
                } else {
                    showGhostBlock(y);
                }
            },
            [showGhostBlock, handleGhostDismiss, hourHeightShared]
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
                height: 2,
                backgroundColor: ThemedColor.error,
                zIndex: 10,
            },
            currentTimeIndicator: {
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: ThemedColor.error,
                position: "absolute",
                top: -4,
                left: -5,
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

        // Open at the first timed task; an empty day opens near now (today) or 8 AM
        useEffect(() => {
            if (hasScrolledToFirstEvent.current) return;

            let targetHour = isSameDay(selectedDate, new Date()) ? new Date().getHours() : 8;
            tasksWithSpecificTime.forEach((task) => {
                const t = task.startTime ?? task.startDate ?? task.deadline;
                if (t) targetHour = Math.min(targetHour, new Date(t).getHours());
            });

            const scrollPosition = Math.max(0, targetHour - 1) * hourHeight;
            let rafId2: number;
            const rafId1 = requestAnimationFrame(() => {
                rafId2 = requestAnimationFrame(() => {
                    if (scrollViewRef.current) {
                        scrollViewRef.current.scrollTo({ y: scrollPosition, animated: true });
                        hasScrolledToFirstEvent.current = true;
                    }
                });
            });
            return () => {
                cancelAnimationFrame(rafId1);
                if (rafId2) cancelAnimationFrame(rafId2);
            };
        }, [tasksWithSpecificTime.length, selectedDate, scrollViewRef]);

        useEffect(() => {
            hasScrolledToFirstEvent.current = false;
        }, [selectedDate]);

        // Dismiss ghost on date change
        useEffect(() => {
            handleGhostDismiss();
        }, [selectedDate, handleGhostDismiss]);

        // Context menu handlers — dismiss ghost block when opening context menu
        const handleLongPress = (task: any) => {
            handleGhostDismiss();
            if (task.projected) {
                router.push({
                    pathname: "/(logged-in)/(tabs)/(task)/task/[id]",
                    params: { name: task.content, id: task.sourceId, categoryId: task.categoryID || "" },
                });
                return;
            }
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

        const handleDeleteTask = () => {
            if (!selectedTask?.id || !selectedTask?.categoryID) return;
            setContextMenuVisible(false);
            deleteWithUndo(selectedTask as Task, selectedTask.categoryID);
        };

        const handleCompleteTask = async () => {
            if (!selectedTask?.id || !selectedTask?.categoryID) return;

            setIsCompleting(true);
            try {
                const res = await markAsCompletedAPI(selectedTask.categoryID, selectedTask.id, {
                    timeCompleted: new Date().toISOString(),
                    timeTaken: "PT0S",
                });
                removeFromCategory(selectedTask.categoryID, selectedTask.id);
                queryClient.invalidateQueries({ queryKey: ["rings", "today"] });

                // If backend returned the next flex instance, insert it immediately
                if (res.nextFlexTask) {
                    addToCategory(res.nextFlexTask.categoryId, {
                        ...res.nextFlexTask.task,
                        categoryID: res.nextFlexTask.categoryId,
                    } as any);
                }

                hapticCompletionBurst();
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
                    onScroll={scrollHandler}
                    scrollEventThrottle={1}
                    stickyHeaderIndices={[0]}
                    contentContainerStyle={{ paddingBottom: bottomInset }}>
                    {/* Pinned above the grid: header content (e.g. overdue) and the day's untimed
                    tasks, so the open-at-first-task scroll can't push them out of sight */}
                    <View style={{ backgroundColor: ThemedColor.background }}>
                        {headerContent}
                        {(tasksForTodayNoTime.length > 0 || onAddAllDay) && (
                            <View style={[styles.allDay, { borderBottomColor: ThemedColor.tertiary }]}>
                                <ThemedText type="caption" numberOfLines={1} style={styles.allDayLabel}>
                                    All day
                                </ThemedText>
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={styles.allDayChips}>
                                    {tasksForTodayNoTime.map((task) => {
                                        const colors = getCategoryDuotoneColors(
                                            task.categoryID,
                                            task.categoryName,
                                            scheme
                                        );
                                        const due =
                                            task.deadline && isSameDay(new Date(task.deadline), selectedDate)
                                                ? new Date(task.deadline)
                                                : null;
                                        const dueLabel =
                                            due && (due.getHours() || due.getMinutes())
                                                ? ` · due ${formatMinutesToTime(due.getHours() * 60 + due.getMinutes())}`
                                                : "";
                                        return (
                                            <TouchableOpacity
                                                key={task.id}
                                                onPress={() => handleLongPress(task)}
                                                activeOpacity={0.7}
                                                style={[
                                                    styles.allDayChip,
                                                    { backgroundColor: colors.background },
                                                    task.projected && { opacity: 0.5 },
                                                ]}>
                                                <View style={[styles.allDayDot, { backgroundColor: colors.dark }]} />
                                                <ThemedText
                                                    type="smallerDefault"
                                                    numberOfLines={1}
                                                    style={{ color: colors.dark, flexShrink: 1 }}>
                                                    {task.content + dueLabel}
                                                </ThemedText>
                                            </TouchableOpacity>
                                        );
                                    })}
                                    {tasksForTodayNoTime.length === 0 && (
                                        <ThemedText type="caption" style={styles.allDayEmpty}>
                                            Nothing yet
                                        </ThemedText>
                                    )}
                                </ScrollView>
                                {onAddAllDay && (
                                    <TouchableOpacity
                                        onPress={onAddAllDay}
                                        hitSlop={10}
                                        style={styles.allDayAdd}
                                        accessibilityLabel="Add an all-day task">
                                        <Plus size={16} color={ThemedColor.caption} weight="bold" />
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}
                    </View>

                    {/* Schedule grid */}
                    <View style={[styles.scheduleSection, { paddingHorizontal: HORIZONTAL_PADDING }]}>
                        <GestureDetector gesture={composedGesture}>
                            <Animated.View style={animatedScheduleContentStyle}>
                                <View style={styles.timeLabels}>
                                    {Array.from({ length: 24 }, (_, i) => (
                                        <Animated.View
                                            key={i}
                                            style={[
                                                animatedTimeLabelStyle,
                                                createAnimatedPositionStyle(i),
                                                { position: "absolute" },
                                            ]}>
                                            <ThemedText type="caption" style={styles.timeText}>
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

                                <Animated.View style={[styles.scheduleTasks, animatedScheduleTasksStyle]}>
                                    {Array.from({ length: 24 }, (_, i) => {
                                        const hour = i;
                                        const tasksInThisHour = tasksWithSpecificTime.filter((task) => {
                                            // Cross-midnight tasks anchor at their clamped
                                            // start for the rendered day (midnight on day 2)
                                            if (task.startTime && task.deadline) {
                                                const w = clampWindowToDay(
                                                    new Date(task.startTime),
                                                    new Date(task.deadline),
                                                    selectedDate
                                                );
                                                if (!w) return false;
                                                return w.start.getHours() === hour;
                                            }
                                            let taskTime;
                                            if (task.startTime) taskTime = new Date(task.startTime);
                                            else if (task.startDate) taskTime = new Date(task.startDate);
                                            else if (task.deadline) taskTime = new Date(task.deadline);
                                            else return false;
                                            return taskTime.getHours() === hour;
                                        });

                                        const now = new Date();
                                        const shouldShowCurrentTime =
                                            hour === now.getHours() && isSameDay(selectedDate, now);

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
                                                {/* Faint cue that an empty hour is tappable; the grid's tap gesture does the work */}
                                                {tasksInThisHour.length === 0 && !ghostBlockVisible && (
                                                    <View pointerEvents="none" style={styles.emptyHourCue}>
                                                        <Plus size={12} color={ThemedColor.caption} weight="bold" />
                                                    </View>
                                                )}
                                                {tasksInThisHour.map((task, index, array) => {
                                                    if (!task) return null;
                                                    const isDeadline =
                                                        task.deadline && !task.startTime && !task.startDate;
                                                    let durationHours = 1;
                                                    let minuteOffset = 0;

                                                    if (task.startTime && task.deadline) {
                                                        // Clamp to the rendered day so
                                                        // cross-midnight blocks stop at the
                                                        // grid edge instead of bleeding past it
                                                        const w = clampWindowToDay(
                                                            new Date(task.startTime),
                                                            new Date(task.deadline),
                                                            selectedDate
                                                        ) ?? {
                                                            start: new Date(task.startTime),
                                                            end: new Date(task.deadline),
                                                        };
                                                        durationHours = Math.min(
                                                            8,
                                                            (w.end.getTime() - w.start.getTime()) / 3600000
                                                        );
                                                        minuteOffset = w.start.getMinutes();
                                                    } else if (task.startTime) {
                                                        minuteOffset = new Date(task.startTime).getMinutes();
                                                    } else if (task.startDate && !isDeadline) {
                                                        minuteOffset = new Date(task.startDate).getMinutes();
                                                    }

                                                    return (
                                                        <CalendarEventCard
                                                            key={task.id || `task-${Math.random()}`}
                                                            task={task}
                                                            hourHeightShared={hourHeightShared}
                                                            durationHours={durationHours}
                                                            minuteOffset={minuteOffset}
                                                            widthPercent={100 / array.length}
                                                            leftPercent={index * (100 / array.length)}
                                                            onLongPress={handleLongPress}
                                                        />
                                                    );
                                                })}
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
                                            onTimeLabelUpdate={updateGhostLabel}
                                        />
                                    )}
                                </Animated.View>
                            </Animated.View>
                        </GestureDetector>
                    </View>
                </Animated.ScrollView>

                <DefaultModal
                    visible={contextMenuVisible}
                    setVisible={setContextMenuVisible}
                    enableDynamicSizing={true}
                    enablePanDownToClose={true}>
                    <View style={{ paddingBottom: 16 }}>
                        <ThemedText type="subtitle" style={{ marginBottom: 16, paddingHorizontal: 4 }}>
                            {selectedTask?.content}
                        </ThemedText>

                        <TouchableOpacity style={[styles.menuOption, { borderTopWidth: 0 }]} onPress={handleSeeMore}>
                            <Info size={24} color={ThemedColor.text} />
                            <ThemedText type="default" style={{ marginLeft: 12, flex: 1 }}>
                                See More
                            </ThemedText>
                            <CaretRight size={20} color={ThemedColor.caption} />
                        </TouchableOpacity>

                        {selectedTask?.workspaceName && (
                            <TouchableOpacity style={styles.menuOption} onPress={handleGoToWorkspace}>
                                <Folder size={24} color={ThemedColor.text} />
                                <View style={{ marginLeft: 12, flex: 1 }}>
                                    <ThemedText type="default">Go to Workspace</ThemedText>
                                    <ThemedText type="caption" style={{ fontSize: 12, marginTop: 2 }}>
                                        {selectedTask.workspaceName}
                                    </ThemedText>
                                </View>
                                <CaretRight size={20} color={ThemedColor.caption} />
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity
                            style={styles.menuOption}
                            onPress={handleCompleteTask}
                            disabled={isCompleting}>
                            <CheckCircle size={24} color={isCompleting ? ThemedColor.caption : ThemedColor.tint} />
                            <ThemedText
                                type="default"
                                style={{
                                    marginLeft: 12,
                                    flex: 1,
                                    color: isCompleting ? ThemedColor.caption : ThemedColor.tint,
                                }}>
                                {isCompleting ? "Completing..." : "Mark as Complete"}
                            </ThemedText>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.menuOption} onPress={handleHideTask} disabled={isHiding}>
                            <EyeSlash size={24} color={isHiding ? ThemedColor.caption : ThemedColor.error} />
                            <ThemedText
                                type="default"
                                style={{
                                    marginLeft: 12,
                                    flex: 1,
                                    color: isHiding ? ThemedColor.caption : ThemedColor.error,
                                }}>
                                {isHiding ? "Hiding..." : "Hide Task"}
                            </ThemedText>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.menuOption} onPress={handleDeleteTask}>
                            <Trash size={24} color={ThemedColor.error} />
                            <ThemedText
                                type="default"
                                style={{
                                    marginLeft: 12,
                                    flex: 1,
                                    color: ThemedColor.error,
                                }}>
                                Delete Task
                            </ThemedText>
                        </TouchableOpacity>
                    </View>
                </DefaultModal>
                {alertElement}
            </View>
        );
    }
);

CalendarViewComponent.displayName = "CalendarView";

const styles = StyleSheet.create({
    emptyHourCue: {
        position: "absolute",
        right: 8,
        top: 8,
        opacity: 0.35,
    },
    scheduleSection: {
        paddingTop: 8,
    },
    allDay: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingLeft: HORIZONTAL_PADDING,
        paddingRight: HORIZONTAL_PADDING,
        paddingBottom: 8,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    allDayLabel: {
        width: TIME_LABEL_WIDTH + 8,
        marginRight: -8,
    },
    allDayChips: {
        gap: 8,
        paddingRight: 8,
    },
    allDayChip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
        maxWidth: 240,
    },
    allDayEmpty: {
        paddingVertical: 4,
    },
    allDayAdd: {
        paddingHorizontal: 4,
    },
    allDayDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
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
