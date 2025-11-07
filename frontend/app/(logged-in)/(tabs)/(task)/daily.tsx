import { Dimensions, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import React, { useRef, useState, useEffect, useMemo } from "react";
import { DrawerLayout } from "react-native-gesture-handler";
import { Drawer } from "@/components/home/Drawer";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { Feather } from "@expo/vector-icons";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import { useThemeColor } from "@/hooks/useThemeColor";
import Entry from "@/components/daily/Entry";
import PagerView from "react-native-pager-view";
import { useTasks } from "@/contexts/tasksContext";
import { useTaskCreation } from "@/contexts/taskCreationContext";
import SwipableTaskCard from "@/components/cards/SwipableTaskCard";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDrawer } from "@/contexts/drawerContext";
import { isSameDay, startOfDay, endOfDay, isWithinInterval } from "date-fns";
import { useLocalSearchParams } from "expo-router";
import { Screen } from "@/components/modals/CreateModal";
import { useCreateModal } from "@/contexts/createModalContext";
import TaskSection from "@/components/task/TaskSection";

type Props = {};

const PAGE_SIZE = 6;

function getDateArray(startDate: Date, numDays: number) {
    return Array.from({ length: numDays }, (_, i) => {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        return d;
    });
}

const Daily = (props: Props) => {
    const drawerRef = useRef(null);
    const pagerRef = useRef<PagerView>(null);
    const ThemedColor = useThemeColor();
    const insets = useSafeAreaInsets();
    const { loadTaskData } = useTaskCreation();
    const { openModal } = useCreateModal();
    
    // State for scheduling
    const [selectedTaskForScheduling, setSelectedTaskForScheduling] = useState<any>(null);
    const [schedulingType, setSchedulingType] = useState<'deadline' | 'startDate'>('deadline');
    
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

    const { allTasks } = useTasks();
    const { setIsDrawerOpen } = useDrawer();

    // Filter tasks based on selected date
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

            // Check if task is in the window between start date and deadline
            if (task.startDate && task.deadline) {
                const taskStartDate = new Date(task.startDate);
                const taskDeadline = new Date(task.deadline);
                if (isWithinInterval(selectedDate, { start: taskStartDate, end: taskDeadline })) {
                    return true;
                }
            }

            return false;
        });
    }, [allTasks, selectedDate]);

    // Filter unscheduled tasks (tasks without start date or deadline)
    const unscheduledTasks = useMemo(() => {
        return allTasks.filter((task) => {
            // Task is unscheduled if it has no start date AND no deadline
            return !task.startDate && !task.deadline;
        });
    }, [allTasks]);

    // Filter upcoming tasks (tasks with future start dates or deadlines)
    const upcomingTasks = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        return allTasks.filter((task) => {
            // Task has a start date in the future
            if (task.startDate) {
                const taskStartDate = new Date(task.startDate);
                taskStartDate.setHours(0, 0, 0, 0);
                if (taskStartDate > today) {
                    return true;
                }
            }
            
            // Task has a deadline in the future (but not a future start date)
            if (task.deadline && !task.startDate) {
                const taskDeadline = new Date(task.deadline);
                taskDeadline.setHours(0, 0, 0, 0);
                if (taskDeadline > today) {
                    return true;
                }
            }
            
            // Task has both, but start date is today or past, and deadline is in the future
            if (task.startDate && task.deadline) {
                const taskStartDate = new Date(task.startDate);
                taskStartDate.setHours(0, 0, 0, 0);
                const taskDeadline = new Date(task.deadline);
                taskDeadline.setHours(0, 0, 0, 0);
                
                if (taskStartDate <= today && taskDeadline > today) {
                    return true;
                }
            }
            
            return false;
        });
    }, [allTasks]);

    // Filter past tasks (tasks with start date older than today and no deadline)
    const pastTasks = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        return allTasks.filter((task) => {
            // Task has a start date that's in the past
            if (!task.startDate) return false;
            
            const taskStartDate = new Date(task.startDate);
            taskStartDate.setHours(0, 0, 0, 0);
            
            // Start date is older than today
            const isPastStart = taskStartDate < today;
            
            // Task has no deadline (or deadline is also in the past, but we'll handle that separately)
            const hasNoDeadline = !task.deadline;
            
            return isPastStart && hasNoDeadline;
        });
    }, [allTasks]);

    // Filter overdue tasks (tasks with past deadline)
    const overdueTasks = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        return allTasks.filter((task) => {
            // Task must have a deadline
            if (!task.deadline) return false;
            
            const taskDeadline = new Date(task.deadline);
            taskDeadline.setHours(0, 0, 0, 0);
            
            // Deadline is in the past
            return taskDeadline < today;
        });
    }, [allTasks]);

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

    // Function to handle quick scheduling of a task
    const handleQuickSchedule = (task: any, type: 'deadline' | 'startDate') => {
        setSelectedTaskForScheduling(task);
        setSchedulingType(type);
        loadTaskData(task);
        openModal({
            edit: true,
            categoryId: task.categoryID || "",
            screen: type === 'deadline' ? Screen.DEADLINE : Screen.STARTDATE
        });
    };

    // Function to handle task completion
    const handleCompleteTask = async (task: any) => {
        try {
            // Import the markAsCompletedAPI function
            const { markAsCompletedAPI } = await import("@/api/task");
            await markAsCompletedAPI(task.categoryID, task.id, {
                timeCompleted: new Date().toISOString(),
                timeTaken: new Date().toISOString(),
            });
            
            // The task will be automatically removed from the list due to context updates
            console.log("Task completed successfully");
        } catch (error) {
            console.error("Error completing task:", error);
        }
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
                
            <View style={[styles.container, { flex: 1, paddingTop: insets.top }]}>

                <ScrollView style={{ flex: 1 }}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ gap: 24, paddingBottom: 128 }}>
                <View style={{ flex: 1 }}>
                <TouchableOpacity onPress={() => drawerRef.current?.openDrawer()}>
                    <Feather name="menu" size={24} color={ThemedColor.caption} />
                </TouchableOpacity>
                <View style={styles.headerContainer}>
                    <ThemedText type="title" style={styles.title}>
                        Daily View
                    </ThemedText>
                </View>
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
                </View>
                    <View style={{ gap: 8 }}>
                        <ThemedText type="subtitle">
                            Tasks for{" "}
                            {selectedDate.toLocaleDateString("en-US", {
                                weekday: "long",
                                month: "long",
                                day: "numeric",
                            })}
                        </ThemedText>
                        {tasksForSelectedDate.length > 0 ? (
                            tasksForSelectedDate.map((task) => (
                                <SwipableTaskCard
                                    key={task.id + task.content}
                                    redirect={true}
                                    categoryId={task.categoryID}
                                    task={task}
                                />
                            ))
                        ) : (
                            <ThemedText type="lightBody" style={{ textAlign: "center", marginTop: 20 }}>
                                No tasks for this date
                            </ThemedText>
                        )}
                    </View>

                    <TaskSection
                        tasks={overdueTasks}
                        title="Overdue Tasks"
                        description=""
                        emptyMessage="No overdue tasks"
                    />
                    <TaskSection
                        tasks={upcomingTasks}
                        title="Upcoming Tasks"
                        description="These tasks have future start dates or deadlines."
                        emptyMessage="No upcoming tasks"
                    />
                    <TaskSection
                        tasks={pastTasks}
                        title="Past Tasks"
                        description="These tasks started in the past but have no deadline."
                        emptyMessage="No past tasks"
                    />
                    <TaskSection
                        tasks={unscheduledTasks}
                        title="Unscheduled Tasks"
                        description="These are tasks that don't have a start date or deadline. Swipe right to schedule for this day."
                        useSchedulable={true}
                        onScheduleTask={handleQuickSchedule}
                        emptyMessage="No unscheduled tasks"
                        schedulingType="deadline"
                    />
                </ScrollView>
            </View>
        </DrawerLayout>
    );
};

export default Daily;

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: HORIZONTAL_PADDING,
    },
    headerContainer: {
        paddingBottom: 24,
        paddingTop: 20,
    },
    title: {
        fontWeight: "600",
    },
    dayOfWeek: {
        marginTop: 4,
        marginBottom: 8,
    },
});
