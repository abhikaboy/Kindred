import { Dimensions, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import React, { useRef, useState, useMemo, useEffect, useCallback } from "react";
import { DrawerLayout, GestureDetector, Gesture } from "react-native-gesture-handler";
import Animated, { 
    useSharedValue, 
    useAnimatedStyle, 
    withSpring, 
    runOnJS,
    interpolate,
    useDerivedValue,
    useAnimatedScrollHandler,
    scrollTo,
    useAnimatedRef,
    useAnimatedReaction
} from "react-native-reanimated";
import { Drawer } from "@/components/home/Drawer";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { Feather } from "@expo/vector-icons";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDrawer } from "@/contexts/drawerContext";
import { useTasks } from "@/contexts/tasksContext";
import SwipableTaskCard from "@/components/cards/SwipableTaskCard";
import { isSameDay, startOfDay, endOfDay, format, addDays, startOfWeek, endOfWeek } from "date-fns";
import Entry from "@/components/daily/Entry";
import PagerView from "react-native-pager-view";
import { router, useLocalSearchParams } from "expo-router";
import UnscheduledTasksSection from "@/components/task/UnscheduledTasksSection";

type Props = {};

const PAGE_SIZE = 7; // 7 days for a week
const TIME_LABEL_WIDTH = 40; // Width of the time labels column (12 AM, 1 PM, etc.)

function getDateArray(startDate: Date, numDays: number) {
    return Array.from({ length: numDays }, (_, i) => {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        return d;
    });
}

const Calendar = (props: Props) => {
    const drawerRef = useRef(null);
    const pagerRef = useRef<PagerView>(null);
    const scrollViewRef = useAnimatedRef<Animated.ScrollView>();
    const currentTimeLineRef = useRef<View>(null);
    const ThemedColor = useThemeColor();
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams();
    const { setIsDrawerOpen } = useDrawer();
    const { allTasks, setSelected } = useTasks();

    // Center date is the first day of the current window
    const [centerDate, setCenterDate] = useState(() => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    });
    const [selectedDate, setSelectedDate] = useState(centerDate);
    const [pageIndex, setPageIndex] = useState(1); // 0: prev, 1: current, 2: next
    
    // Schedule Layout Configuration - using shared values for smooth animations
    const hourHeightShared = useSharedValue(40); // Animated height in pixels for each hour
    const [hourHeight, setHourHeight] = useState(40); // State for non-animated components
    
    // Helper function to adjust hour height with smooth animations
    const adjustHourHeight = (newHeight: number, animated: boolean = true) => {
        // Clamp between reasonable bounds to prevent unusable UI
        const clampedHeight = Math.max(20, Math.min(80, newHeight));
        
        if (animated) {
            // Smooth spring animation for the shared value
            hourHeightShared.value = withSpring(clampedHeight, {
                damping: 20,
                stiffness: 300,
                mass: 0.5,
            });
        } else {
            // Immediate update for gestures (more responsive)
            hourHeightShared.value = clampedHeight;
        }
        
        // Update state for non-animated components
        setHourHeight(clampedHeight);
    };

    // Track the initial hour height when pinch starts
    const [initialPinchHeight, setInitialPinchHeight] = useState(40);
    const [isPinching, setIsPinching] = useState(false);

    // Shared values to track initial pinch state for performance
    const initialPinchHeightShared = useSharedValue(40);
    const initialScrollPositionShared = useSharedValue(0);
    const focalPointYShared = useSharedValue(0);
    const animatedScrollY = useSharedValue(0);
    const isPinchingShared = useSharedValue(false);
    
    // State to track current scroll position
    const [currentScrollY, setCurrentScrollY] = useState(0);

    // Animated scroll handler for smooth tracking
    const scrollHandler = useAnimatedScrollHandler({
        onScroll: (event) => {
            animatedScrollY.value = event.contentOffset.y;
            runOnJS(setCurrentScrollY)(event.contentOffset.y);
        },
    });

    // Function to smoothly update scroll position using animated values
    const updateScrollPositionSmooth = (targetY: number) => {
        'worklet';
        if (scrollViewRef.current) {
            scrollTo(scrollViewRef, 0, targetY, false);
        }
    };

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
                
                // Use scrollTo to smoothly update the scroll position
                scrollTo(scrollViewRef, 0, clampedScrollY, false);
            }
        }
    );

    // Pinch gesture implementation for adjusting hour height with focal point scaling
    const pinchGesture = Gesture.Pinch()
        .onBegin((event) => {
            // Store the initial state when pinch starts
            initialPinchHeightShared.value = hourHeightShared.value;
            // Store the focal point relative to the scroll view content
            focalPointYShared.value = event.focalY - 200; // Approximate offset for header content
            initialScrollPositionShared.value = animatedScrollY.value;
            isPinchingShared.value = true;
            
            runOnJS(setIsPinching)(true);
        })
        .onUpdate((event) => {
            // Calculate new height based on pinch scale
            const newHeight = initialPinchHeightShared.value * event.scale;
            const clampedHeight = Math.max(20, Math.min(80, newHeight));
            
            // Update height - scroll position will be automatically updated by useAnimatedReaction
            hourHeightShared.value = clampedHeight;
            
            // Update state for UI feedback (throttled)
            if (Math.abs(clampedHeight - hourHeight) > 2) {
                runOnJS(setHourHeight)(clampedHeight);
            }
        })
        .onEnd(() => {
            isPinchingShared.value = false;
            
            // Add a subtle spring animation when gesture ends
            hourHeightShared.value = withSpring(hourHeightShared.value, {
                damping: 25,
                stiffness: 400,
            });
            runOnJS(setIsPinching)(false);
        })
        .onFinalize(() => {
            // Ensure pinching state is reset even if gesture is cancelled
            isPinchingShared.value = false;
            runOnJS(setIsPinching)(false);
        });

    // Calculate date windows
    const prevStart = new Date(centerDate);
    prevStart.setDate(centerDate.getDate() - PAGE_SIZE);
    const nextStart = new Date(centerDate);
    nextStart.setDate(centerDate.getDate() + PAGE_SIZE);

    const prevDates = getDateArray(prevStart, PAGE_SIZE);
    const currentDates = getDateArray(centerDate, PAGE_SIZE);
    const nextDates = getDateArray(nextStart, PAGE_SIZE);

    // Handle page change
    const onPageSelected = (e: any) => {
        const position = e.nativeEvent.position;
        if (position === 2) {
            // Swiped forward
            const newCenter = new Date(centerDate);
            newCenter.setDate(centerDate.getDate() + PAGE_SIZE);
            setCenterDate(newCenter);
            setPageIndex(1);
        } else if (position === 0) {
            // Swiped backward
            const newCenter = new Date(centerDate);
            newCenter.setDate(centerDate.getDate() - PAGE_SIZE);
            setCenterDate(newCenter);
            setPageIndex(1);
        } else {
            setPageIndex(position);
        }
    };

    // After centerDate changes, reset PagerView to the middle page
    useEffect(() => {
        if (pagerRef.current && pageIndex !== 1) {
            pagerRef.current.setPageWithoutAnimation(1);
        }
    }, [centerDate]);

    // Set selected workspace based on route parameters
    useEffect(() => {
        if (params.workspace && typeof params.workspace === 'string') {
            setSelected(params.workspace);
        }
    }, [params.workspace, setSelected]);

    // Scroll to current time line when component mounts or selected date changes
    useEffect(() => {
        const scrollToCurrentTime = () => {
            // Only scroll to current time if we're viewing today
            const today = new Date();
            const isToday = isSameDay(selectedDate, today);
            
            if (isToday && scrollViewRef.current) {
                // Calculate the scroll position to center the current time line in view
                const now = new Date();
                const currentHour = now.getHours();
                const currentMinute = now.getMinutes();
                
                // Calculate the exact position within the schedule using current height
                const currentHourHeight = hourHeightShared.value;
                const hourPosition = currentHour * currentHourHeight;
                const minuteOffset = (currentMinute / 60) * currentHourHeight; // Position within the hour
                const totalPosition = hourPosition + minuteOffset;
                
                // Scroll to position with some offset to show context above
                const scrollY = Math.max(0, totalPosition - 100); // 100px offset from top
                
                scrollViewRef.current.scrollTo({ 
                    y: scrollY, 
                    animated: true 
                });
            } else if (!isToday && scrollViewRef.current) {
                // For other days, scroll to the top
                scrollViewRef.current.scrollTo({ 
                    y: 0, 
                    animated: true 
                });
            }
        };

        // Add a small delay to ensure the layout is complete
        const timer = setTimeout(scrollToCurrentTime, 100);
        return () => clearTimeout(timer);
    }, [selectedDate]);

    // Filter tasks for the selected date
    const tasksForSelectedDate = useMemo(() => {
        const selectedDateStart = startOfDay(selectedDate);
        const selectedDateEnd = endOfDay(selectedDate);

        return allTasks.filter((task) => {
            // Check if task starts on the selected date
            if (task.startDate) {
                const taskStartDate = new Date(task.startDate);
                if (isSameDay(taskStartDate, selectedDate)) {
                    return true;
                }
            }

            // Check if task is due on the selected date
            if (task.deadline) {
                const taskDeadline = new Date(task.deadline);
                if (isSameDay(taskDeadline, selectedDate)) {
                    return true;
                }
            }

            return false;
        });
    }, [allTasks, selectedDate]);

    // Filter tasks with specific time set (for the schedule section)
    const tasksWithSpecificTime = useMemo(() => {
        return tasksForSelectedDate.filter((task) => {
            if (task.startTime) {
                return true; // Has explicit start time
            }
            if (task.startDate) {
                const taskDate = new Date(task.startDate);
                // Check if the time component is meaningful (not just 00:00:00)
                const hasSpecificTime = taskDate.getHours() !== 0 || taskDate.getMinutes() !== 0 || taskDate.getSeconds() !== 0;
                return hasSpecificTime;
            }
            return false;
        });
    }, [tasksForSelectedDate]);

    // Filter tasks scheduled for today but without specific time
    const tasksForTodayNoTime = useMemo(() => {
        return tasksForSelectedDate.filter((task) => {
            // Has startDate but no meaningful time
            if (task.startDate) {
                // Case 1: No startTime at all (nil/undefined)
                if (!task.startTime) {
                    const taskDate = new Date(task.startDate);
                    // Only date component, no meaningful time (00:00:00)
                    const hasNoSpecificTime = taskDate.getHours() === 0 && taskDate.getMinutes() === 0 && taskDate.getSeconds() === 0;
                    return hasNoSpecificTime;
                }
                // Case 2: Has startTime but it's set to 00:00:00 (midnight)
                else {
                    const startTime = new Date(task.startTime);
                    const hasNoSpecificTime = startTime.getHours() === 0 && startTime.getMinutes() === 0 && startTime.getSeconds() === 0;
                    return hasNoSpecificTime;
                }
            }
            return false;
        });
    }, [tasksForSelectedDate]);

    // Filter tasks without any date/time set (truly unscheduled)
    const tasksUnscheduled = useMemo(() => {
        return tasksForSelectedDate.filter((task) => {
            // No startDate and only has deadline (if any)
            return !task.startDate && !task.startTime;
        });
    }, [tasksForSelectedDate]);

    // Helper to render a page of dates
    const renderDatePage = (dates: Date[]) => (
        <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
                <ThemedText type="subtitle">{centerDate.toLocaleDateString("en-US", { month: "long" })}</ThemedText>
            </View>
            <View
                style={{
                    gap: 12,
                    flexDirection: "row",
                }}>
                {dates.map((date, idx) => (
                    <Entry
                        day={date.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()}
                        date={date.getDate().toString()}
                        outline={
                            date.getMonth() === selectedDate.getMonth() &&
                            date.getUTCDate() === selectedDate.getUTCDate()
                        }
                        onPress={() => setSelectedDate(date)}
                        key={date.toISOString()}
                    />
                ))}
            </View>
        </View>
    );

    // Create themed and dynamic styles
    const themedStyles = StyleSheet.create({
        scheduleTaskContent: {
            height: '100%', // Fill the container but don't expand beyond it
            maxHeight: '100%', // Don't exceed container height
            overflow: 'hidden', // Hide any overflow content
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: ThemedColor.text,
            justifyContent: 'center', // Center content vertically
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
            top: -5, // Position it above the line
            left: -6, // Center it on the line
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

    // Animated styles using useAnimatedStyle for smooth transitions
    const animatedScheduleContentStyle = useAnimatedStyle(() => {
        return {
            flexDirection: "row" as const,
            gap: 32,
            position: "relative" as const,
            height: 24 * hourHeightShared.value, // 24 hours with smooth height transitions
            opacity: withSpring(isPinching ? 0.8 : 1, { damping: 20 }),
        };
    });

    const animatedTimeLabelStyle = useAnimatedStyle(() => {
        return {
            height: hourHeightShared.value,
            justifyContent: "center" as const,
            position: "absolute" as const,
            left: 0,
            right: 0,
        };
    });

    const animatedHourSlotStyle = useAnimatedStyle(() => {
        return {
            minHeight: hourHeightShared.value,
            gap: 8,
            position: "absolute" as const,
            left: 0,
            right: 0,
        };
    });

    // Create a global animated style that can be used with different parameters
    const baseTaskAnimatedStyle = useAnimatedStyle(() => {
        return {
            // This will be extended with specific task parameters using transform
        };
    });

    // Create task style that dynamically calculates based on current hour height
    const createTaskStyle = (durationHours: number, minuteOffset: number = 0) => {
        // Use the current value of hourHeightShared for calculations
        const currentHourHeight = hourHeight; // Use the state value which updates with gestures
        const proportionalHeight = durationHours * currentHourHeight * 0.85; // Use 85% of hour space
        const taskHeight = proportionalHeight; // No minimum height - let tasks be proportionally sized
        const topOffset = (minuteOffset / 60) * currentHourHeight;
        
        return {
            height: taskHeight,
            maxHeight: taskHeight, // Enforce the calculated height strictly
            overflow: 'hidden' as const, // CRITICAL: Hide any content that exceeds bounds
            marginBottom: 4,
            marginTop: topOffset,
        };
    };

    // Animated style for the schedule tasks container that scales with total schedule height
    const animatedScheduleTasksStyle = useAnimatedStyle(() => {
        const totalScheduleHeight = 24 * hourHeightShared.value;
        return {
            height: totalScheduleHeight,
        };
    });

    // Pre-create all 24 animated position styles (compact approach)
    const animatedPositionStyles = [
        useAnimatedStyle(() => ({ transform: [{ translateY: 0 * hourHeightShared.value }] })),
        useAnimatedStyle(() => ({ transform: [{ translateY: 1 * hourHeightShared.value }] })),
        useAnimatedStyle(() => ({ transform: [{ translateY: 2 * hourHeightShared.value }] })),
        useAnimatedStyle(() => ({ transform: [{ translateY: 3 * hourHeightShared.value }] })),
        useAnimatedStyle(() => ({ transform: [{ translateY: 4 * hourHeightShared.value }] })),
        useAnimatedStyle(() => ({ transform: [{ translateY: 5 * hourHeightShared.value }] })),
        useAnimatedStyle(() => ({ transform: [{ translateY: 6 * hourHeightShared.value }] })),
        useAnimatedStyle(() => ({ transform: [{ translateY: 7 * hourHeightShared.value }] })),
        useAnimatedStyle(() => ({ transform: [{ translateY: 8 * hourHeightShared.value }] })),
        useAnimatedStyle(() => ({ transform: [{ translateY: 9 * hourHeightShared.value }] })),
        useAnimatedStyle(() => ({ transform: [{ translateY: 10 * hourHeightShared.value }] })),
        useAnimatedStyle(() => ({ transform: [{ translateY: 11 * hourHeightShared.value }] })),
        useAnimatedStyle(() => ({ transform: [{ translateY: 12 * hourHeightShared.value }] })),
        useAnimatedStyle(() => ({ transform: [{ translateY: 13 * hourHeightShared.value }] })),
        useAnimatedStyle(() => ({ transform: [{ translateY: 14 * hourHeightShared.value }] })),
        useAnimatedStyle(() => ({ transform: [{ translateY: 15 * hourHeightShared.value }] })),
        useAnimatedStyle(() => ({ transform: [{ translateY: 16 * hourHeightShared.value }] })),
        useAnimatedStyle(() => ({ transform: [{ translateY: 17 * hourHeightShared.value }] })),
        useAnimatedStyle(() => ({ transform: [{ translateY: 18 * hourHeightShared.value }] })),
        useAnimatedStyle(() => ({ transform: [{ translateY: 19 * hourHeightShared.value }] })),
        useAnimatedStyle(() => ({ transform: [{ translateY: 20 * hourHeightShared.value }] })),
        useAnimatedStyle(() => ({ transform: [{ translateY: 21 * hourHeightShared.value }] })),
        useAnimatedStyle(() => ({ transform: [{ translateY: 22 * hourHeightShared.value }] })),
        useAnimatedStyle(() => ({ transform: [{ translateY: 23 * hourHeightShared.value }] })),
    ];

    // Pre-create all 24 animated hour line styles (compact approach)
    const animatedHourLineStyles = [
        useAnimatedStyle(() => ({ transform: [{ translateY: 0 * hourHeightShared.value + hourHeightShared.value / 2 }] })),
        useAnimatedStyle(() => ({ transform: [{ translateY: 1 * hourHeightShared.value + hourHeightShared.value / 2 }] })),
        useAnimatedStyle(() => ({ transform: [{ translateY: 2 * hourHeightShared.value + hourHeightShared.value / 2 }] })),
        useAnimatedStyle(() => ({ transform: [{ translateY: 3 * hourHeightShared.value + hourHeightShared.value / 2 }] })),
        useAnimatedStyle(() => ({ transform: [{ translateY: 4 * hourHeightShared.value + hourHeightShared.value / 2 }] })),
        useAnimatedStyle(() => ({ transform: [{ translateY: 5 * hourHeightShared.value + hourHeightShared.value / 2 }] })),
        useAnimatedStyle(() => ({ transform: [{ translateY: 6 * hourHeightShared.value + hourHeightShared.value / 2 }] })),
        useAnimatedStyle(() => ({ transform: [{ translateY: 7 * hourHeightShared.value + hourHeightShared.value / 2 }] })),
        useAnimatedStyle(() => ({ transform: [{ translateY: 8 * hourHeightShared.value + hourHeightShared.value / 2 }] })),
        useAnimatedStyle(() => ({ transform: [{ translateY: 9 * hourHeightShared.value + hourHeightShared.value / 2 }] })),
        useAnimatedStyle(() => ({ transform: [{ translateY: 10 * hourHeightShared.value + hourHeightShared.value / 2 }] })),
        useAnimatedStyle(() => ({ transform: [{ translateY: 11 * hourHeightShared.value + hourHeightShared.value / 2 }] })),
        useAnimatedStyle(() => ({ transform: [{ translateY: 12 * hourHeightShared.value + hourHeightShared.value / 2 }] })),
        useAnimatedStyle(() => ({ transform: [{ translateY: 13 * hourHeightShared.value + hourHeightShared.value / 2 }] })),
        useAnimatedStyle(() => ({ transform: [{ translateY: 14 * hourHeightShared.value + hourHeightShared.value / 2 }] })),
        useAnimatedStyle(() => ({ transform: [{ translateY: 15 * hourHeightShared.value + hourHeightShared.value / 2 }] })),
        useAnimatedStyle(() => ({ transform: [{ translateY: 16 * hourHeightShared.value + hourHeightShared.value / 2 }] })),
        useAnimatedStyle(() => ({ transform: [{ translateY: 17 * hourHeightShared.value + hourHeightShared.value / 2 }] })),
        useAnimatedStyle(() => ({ transform: [{ translateY: 18 * hourHeightShared.value + hourHeightShared.value / 2 }] })),
        useAnimatedStyle(() => ({ transform: [{ translateY: 19 * hourHeightShared.value + hourHeightShared.value / 2 }] })),
        useAnimatedStyle(() => ({ transform: [{ translateY: 20 * hourHeightShared.value + hourHeightShared.value / 2 }] })),
        useAnimatedStyle(() => ({ transform: [{ translateY: 21 * hourHeightShared.value + hourHeightShared.value / 2 }] })),
        useAnimatedStyle(() => ({ transform: [{ translateY: 22 * hourHeightShared.value + hourHeightShared.value / 2 }] })),
        useAnimatedStyle(() => ({ transform: [{ translateY: 23 * hourHeightShared.value + hourHeightShared.value / 2 }] })),
    ];

    // Helper functions to access styles by hour
    const createAnimatedPositionStyle = (hour: number) => animatedPositionStyles[hour];
    const createAnimatedHourLineStyle = (hour: number) => animatedHourLineStyles[hour];

    // Current time line animated style (created at top level)
    const currentTimeLineAnimatedStyle = useAnimatedStyle(() => {
        // Get the current time for positioning
        const now = new Date();
        const currentMinute = now.getMinutes();
        
        const position = (currentMinute / 60) * hourHeightShared.value;
        return {
            transform: [{ translateY: position }],
            opacity: 1,
        };
    });

    // Dynamic styles for non-animated components
    const dynamicStyles = {
        pinchIndicator: {
            position: "absolute" as const,
            top: 10,
            right: 10,
            backgroundColor: ThemedColor.primary,
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 12,
            opacity: isPinching ? 1 : 0,
            zIndex: 1000,
        },
    };

    return (
        <DrawerLayout
            ref={drawerRef}
            hideStatusBar
            edgeWidth={50}
            drawerWidth={Dimensions.get("screen").width * 0.75}
            renderNavigationView={() => <Drawer close={drawerRef.current?.closeDrawer} />}
            drawerPosition="left"
            drawerType="front"
            onDrawerOpen={() => setIsDrawerOpen(true)}
            onDrawerClose={() => setIsDrawerOpen(false)}>
            <ThemedView style={[styles.container, { flex: 1, paddingTop: insets.top }]}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => drawerRef.current?.openDrawer()}>
                        <Feather name="menu" size={24} color={ThemedColor.caption} />
                    </TouchableOpacity>
                </View>

                {/* Title */}
                <View style={styles.titleContainer}>
                    <ThemedText type="title" style={styles.title}>
                        Calendar
                    </ThemedText>
                </View>

                {/* Day Picker */}
                <View style={{ marginBottom: 24, height: Dimensions.get("screen").height * 0.125 }}>
                    <PagerView
                        ref={pagerRef}
                        style={{ flex: 1 }}
                        initialPage={1}
                        onPageSelected={onPageSelected}
                        key={centerDate.toISOString()}>
                        <View key="prev" style={{ flex: 1 }}>
                            {renderDatePage(prevDates)}
                        </View>
                        <View key="current" style={{ flex: 1 }}>
                            {renderDatePage(currentDates)}
                        </View>
                        <View key="next" style={{ flex: 1 }}>
                            {renderDatePage(nextDates)}
                        </View>
                    </PagerView>
                </View>

                <Animated.ScrollView
                    ref={scrollViewRef}
                    style={{ flex: 1 }}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    onScroll={scrollHandler}
                    scrollEventThrottle={1}>
                    {/* Schedule Section */}
                    <View style={styles.scheduleSection}>
                        <GestureDetector gesture={pinchGesture}>
                            <Animated.View style={animatedScheduleContentStyle}>
                                {/* Pinch indicator */}
                                <View style={dynamicStyles.pinchIndicator}>
                                    <ThemedText type="caption" style={{ color: ThemedColor.background, fontSize: 10 }}>
                                        {hourHeight}px
                                    </ThemedText>
                                </View>
                                
                            <View style={styles.timeLabels}>
                                {Array.from({ length: 24 }, (_, i) => {
                                    // Show full 24 hours from 12 AM to 11 PM
                                    const hour = i;
                                    return (
                                        <Animated.View 
                                            key={hour} 
                                            style={[
                                                animatedTimeLabelStyle,
                                                createAnimatedPositionStyle(hour),
                                                { position: 'absolute' }
                                            ]}
                                        >
                                            <ThemedText type="caption" style={styles.timeText}>
                                                {`${hour === 0 ? 12 : hour > 12 ? hour - 12 : hour} ${hour >= 12 ? "PM" : "AM"}`}
                                            </ThemedText>
                                        </Animated.View>
                                    );
                                })}
                                        </View>
                            
                            {/* Hour lines */}
                            <View style={styles.hourLines}>
                                {Array.from({ length: 24 }, (_, i) => {
                                    const hour = i;
                                    return (
                                        <Animated.View
                                            key={`line-${hour}`}
                                            style={[
                                                themedStyles.hourLine,
                                                createAnimatedHourLineStyle(hour),
                                                { position: 'absolute' }
                                            ]}
                                        />
                                    );
                                })}
                            </View>
                            <Animated.View style={[styles.scheduleTasks, animatedScheduleTasksStyle]}>
                                {Array.from({ length: 24 }, (_, i) => {
                                    const hour = i;
                                    const tasksInThisHour = tasksWithSpecificTime.filter((task) => {
                                        // Use startTime if available, otherwise fall back to startDate
                                        let taskTime;
                                        if (task.startTime) {
                                            taskTime = new Date(task.startTime);
                                        } else if (task.startDate) {
                                            taskTime = new Date(task.startDate);
                                        } else if (task.deadline) {
                                            // For deadline tasks, use the deadline time
                                            taskTime = new Date(task.deadline);
                                        } else {
                                            return false;
                                        }
                                        const taskHour = taskTime.getHours();
                                        return taskHour === hour;
                                    });

                                    const now = new Date();
                                    const currentHour = now.getHours();
                                    const currentMinute = now.getMinutes();
                                    const isCurrentHour = hour === currentHour;
                                    const isToday = isSameDay(selectedDate, now);

                                    // Check if we should show current time line for this hour
                                    const shouldShowCurrentTime = isCurrentHour && isToday;

                                    return (
                                        <Animated.View 
                                            key={hour} 
                                            style={[
                                                animatedHourSlotStyle,
                                                createAnimatedPositionStyle(hour),
                                                { position: 'absolute' }
                                            ]}
                                        >
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
                                            {tasksInThisHour.map((task) => {
                                                if (!task) return null; // Skip null tasks

                                                const isDeadline = task.deadline && !task.startTime && !task.startDate;
                                                
                                                // Calculate task duration and positioning
                                                let durationHours = 1; // Default 1 hour
                                                let minuteOffset = 0;
                                                
                                                if (task.startTime && task.deadline) {
                                                    const startTime = new Date(task.startTime);
                                                    const endTime = new Date(task.deadline);
                                                    const durationMs = endTime.getTime() - startTime.getTime();
                                                    
                                                    // Convert to hours and clamp to reasonable values
                                                    const calculatedDuration = durationMs / (1000 * 60 * 60);
                                                    durationHours = Math.max(0.5, Math.min(8, calculatedDuration)); // Between 30 min and 8 hours
                                                    minuteOffset = startTime.getMinutes();
                                                } else if (task.startTime) {
                                                    const startTime = new Date(task.startTime);
                                                    minuteOffset = startTime.getMinutes();
                                                    durationHours = 1; // Default 1 hour for tasks with start time but no deadline
                                                } else if (task.startDate && !isDeadline) {
                                                    const startTime = new Date(task.startDate);
                                                    minuteOffset = startTime.getMinutes();
                                                    durationHours = 1; // Default 1 hour for tasks with start date
                                                }
                                                
                                                const taskStyle = createTaskStyle(durationHours, minuteOffset);

                                                return (
                                                    <View
                                                        key={task.id || `task-${Math.random()}`}
                                                        style={taskStyle}
                                                    >
                                                        <TouchableOpacity
                                                            style={styles.scheduleTaskTouchable}
                                                        onPress={() => {
                                                            console.log("Clicked task:", task);
                                                            console.log("Task ID on click:", task.id);

                                                            if (task.id) {
                                                                console.log("Navigating to task ID:", task.id);
                                                                router.push({
                                                                    pathname: "/(logged-in)/(tabs)/(task)/task/[id]",
                                                                    params: {
                                                                        name: task.content,
                                                                        id: task.id,
                                                                        categoryId: task.categoryID || "",
                                                                    },
                                                                });
                                                            } else {
                                                                console.warn("Task has no ID:", task);
                                                                console.warn(
                                                                    "Available properties:",
                                                                    Object.keys(task)
                                                                );
                                                            }
                                                        }}>
                                                            <View
                                                            style={[
                                                                themedStyles.scheduleTaskContent,
                                                                isDeadline && themedStyles.deadlineTaskContent,
                                                            ]}>
                                                            <ThemedText
                                                                type="lightBody"
                                                                style={isDeadline && themedStyles.deadlineText}>
                                                                {isDeadline
                                                                    ? `${task.content} [Deadline]`
                                                                    : task.content}
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

                    {/* Today's Tasks Section */}
                    <UnscheduledTasksSection
                        tasks={tasksForTodayNoTime}
                        title="Today's Tasks"
                        description="These are tasks scheduled for today, but don't have a specific time assigned."
                        useSchedulable={false}
                        emptyMessage="No tasks scheduled for today without specific times"
                    />

                    {/* Unscheduled Tasks Section */}
                    <UnscheduledTasksSection
                        tasks={tasksUnscheduled}
                        title="Unscheduled Tasks"
                        description="These are tasks that don't have a start date or deadline. Swipe right to schedule for this day."
                        useSchedulable={true}
                        onScheduleTask={(task, type) => {
                            // Handle scheduling logic here
                            console.log('Scheduling task:', task.content, 'as:', type);
                        }}
                        schedulingType="startDate"
                        emptyMessage="No unscheduled tasks"
                    />

                    {/* Workspaces Section */}
                    <View style={styles.section}>
                        <ThemedText type="subtitle" style={styles.sectionTitle}>
                            Workspaces
                        </ThemedText>
                        {/* Add workspace content here */}
                    </View>
                </Animated.ScrollView>
            </ThemedView>
        </DrawerLayout>
    );
};

export default Calendar;

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: HORIZONTAL_PADDING,
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 24,
    },
    titleContainer: {
        marginBottom: 24,
    },
    title: {
        fontSize: 32,
        fontWeight: "600",
        letterSpacing: -1,
    },
    scrollContent: {
        gap: 24,
        paddingBottom: 128,
    },
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
        zIndex: 1, // Behind tasks and below schedule tasks
    },

    timeText: {
        fontSize: 12,
    },
    scheduleTasks: {
        flex: 1,
        position: "absolute",
        left: TIME_LABEL_WIDTH + 8, // Time label width + gap
        right: 0,
        top: 0,
        zIndex: 3, // Above hour lines to ensure tasks are clickable
        // height is now controlled by animatedScheduleTasksStyle
    },

    scheduleTask: {
        marginBottom: 8,
    },
    scheduleTaskTouchable: {
        flex: 1,
        width: '100%',
        height: '100%',
        overflow: 'hidden', // Ensure touchable area respects bounds
    },
    section: {
        gap: 12,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: "600",
        letterSpacing: -1,
    },
});

