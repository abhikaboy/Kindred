import { Dimensions, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import React, { useRef, useState, useMemo, useEffect } from "react";
import { DrawerLayout } from "react-native-gesture-handler";
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

type Props = {};

const PAGE_SIZE = 7; // 7 days for a week

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
    const scrollViewRef = useRef<ScrollView>(null);
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

    // Scroll to current time position when component mounts or selected date changes
    useEffect(() => {
        if (scrollViewRef.current) {
            const currentHour = new Date().getHours();
            const scrollToHour = Math.max(0, currentHour - 1); // 1 hour before current time
            // Calculate scroll position: each hour is 40px, and we want 1 hour before current time at the top
            // Since the schedule starts at the top of the scroll view, we scroll to the hour position
            const scrollY = (scrollToHour - 1) * 40; // Updated to 40px per hour
            console.log(`Current hour: ${currentHour}, Scroll to hour: ${scrollToHour}, Scroll Y: ${scrollY}`);
            scrollViewRef.current.scrollTo({ y: scrollY, animated: false });
        }
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

    // Filter tasks with time set (for the schedule section)
    const tasksWithTime = useMemo(() => {
        return tasksForSelectedDate.filter((task) => task.startDate);
    }, [tasksForSelectedDate]);

    // Filter tasks without time set
    const tasksWithoutTime = useMemo(() => {
        return tasksForSelectedDate.filter((task) => !task.startDate);
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

    // Create themed styles
    const themedStyles = StyleSheet.create({
        scheduleTaskContent: {
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: ThemedColor.text,
            backgroundColor: ThemedColor.lightened,
            minHeight: 24,
            maxHeight: 32,
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
    });

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

                <ScrollView
                    ref={scrollViewRef}
                    style={{ flex: 1 }}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}>
                    {/* Schedule Section */}
                    <View style={styles.scheduleSection}>
                        <View style={styles.scheduleContent}>
                            <View style={styles.timeLabels}>
                                {Array.from({ length: 24 }, (_, i) => {
                                    // Show full 24 hours from 12 AM to 11 PM
                                    const hour = i;
                                    return (
                                        <View key={hour} style={[styles.timeLabelItem, { top: hour * 40 }]}>
                                            <ThemedText type="caption" style={styles.timeText}>
                                                {`${hour === 0 ? 12 : hour > 12 ? hour - 12 : hour} ${hour >= 12 ? "PM" : "AM"}`}
                                            </ThemedText>
                                        </View>
                                    );
                                })}
                            </View>
                            <View style={styles.scheduleTasks}>
                                {Array.from({ length: 24 }, (_, i) => {
                                    const hour = i;
                                    const tasksInThisHour = tasksForSelectedDate.filter((task) => {
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

                                    // Calculate exact position for current time line (down to the minute)
                                    const currentTimePosition = isCurrentHour
                                        ? (currentMinute / 60) * 40 // 40px per hour, so (minute/60) * 40 gives exact position
                                        : null;

                                    return (
                                        <View key={hour} style={[styles.hourSlot, { top: hour * 40 }]}>
                                            {isCurrentHour && currentTimePosition !== null && (
                                                <View
                                                    style={[
                                                        themedStyles.currentTimeLine,
                                                        { top: currentTimePosition },
                                                    ]}>
                                                    <View style={themedStyles.currentTimeIndicator} />
                                                </View>
                                            )}
                                            {tasksInThisHour.map((task) => {
                                                if (!task) return null; // Skip null tasks

                                                const isDeadline = task.deadline && !task.startTime && !task.startDate;

                                                return (
                                                    <TouchableOpacity
                                                        key={task.id || `task-${Math.random()}`}
                                                        style={styles.scheduleTask}
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
                                                        <ThemedView
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
                                                        </ThemedView>
                                                    </TouchableOpacity>
                                                );
                                            })}
                                        </View>
                                    );
                                })}
                            </View>
                        </View>
                    </View>

                    {/* No Time Set Section */}
                    {tasksWithoutTime.length > 0 && (
                        <View style={styles.section}>
                            <ThemedText type="subtitle" style={styles.sectionTitle}>
                                No Time Set
                            </ThemedText>
                            {tasksWithoutTime.map((task) => (
                                <SwipableTaskCard
                                    key={task.id}
                                    redirect={true}
                                    categoryId={task.categoryID}
                                    task={task}
                                />
                            ))}
                        </View>
                    )}

                    {/* Workspaces Section */}
                    <View style={styles.section}>
                        <ThemedText type="subtitle" style={styles.sectionTitle}>
                            Workspaces
                        </ThemedText>
                        {/* Add workspace content here */}
                    </View>
                </ScrollView>
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
    },
    scheduleSection: {
        marginBottom: 24,
    },
    scheduleContent: {
        flexDirection: "row",
        gap: 8,
        position: "relative",
        height: 24 * 40, // 24 hours * 40px per hour for more spacing
    },
    timeLabels: {
        width: 40,
        position: "absolute",
        left: 0,
        top: 0,
        height: "100%",
    },
    timeLabelItem: {
        height: 40,
        justifyContent: "center",
        position: "absolute",
        left: 0,
        right: 0,
    },
    timeText: {
        fontSize: 12,
    },
    scheduleTasks: {
        flex: 1,
        position: "absolute",
        left: 48, // 40px width + 8px gap
        right: 0,
        top: 0,
        height: "100%",
    },
    hourSlot: {
        minHeight: 40,
        gap: 8,
        position: "absolute",
        left: 0,
        right: 0,
    },
    scheduleTask: {
        marginBottom: 8,
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
