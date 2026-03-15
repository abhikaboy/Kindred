import { Dimensions, StyleSheet, TouchableOpacity, View, InteractionManager } from "react-native";
import React, { useRef, useState, useEffect, useCallback } from "react";
import { DrawerLayout } from "react-native-gesture-handler";
import { Drawer } from "@/components/home/Drawer";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useTaskCreation } from "@/contexts/taskCreationContext";
import { useTasks } from "@/contexts/tasksContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDrawer } from "@/contexts/drawerContext";
import { Screen } from "@/components/modals/CreateModal";
import { useCreateModal } from "@/contexts/createModalContext";
import { useLocalSearchParams } from "expo-router";
import Animated, {
    useSharedValue,
    useAnimatedScrollHandler,
    useAnimatedRef,
} from "react-native-reanimated";

// Components
import { DailyHeader } from "@/components/daily/DailyHeader";
import { DatePager } from "@/components/daily/DatePager";
import { TaskListView } from "@/components/daily/TaskListView";
import { CalendarView, ScheduleTimeRange } from "@/components/daily/CalendarView";
import { ScheduleTaskSheet } from "@/components/daily/ScheduleTaskSheet";
import { FloatingDateNav } from "@/components/daily/FloatingDateNav";
import { AnimatedTabContent } from "@/components/inputs/AnimatedTabs";

// Hooks
import { useDailyTasks } from "@/hooks/useDailyTasks";

type Props = {};

const Daily = (props: Props) => {
    const drawerRef = useRef<DrawerLayout>(null);
    // For list view scrolling
    const scrollViewRef = useAnimatedRef<Animated.ScrollView>();
    // For calendar view - it manages its own scroll ref internally but we might need to expose it if we wanted parent control
    // For now, CalendarView handles its own scrolling

    const ThemedColor = useThemeColor();
    const insets = useSafeAreaInsets();
    const { loadTaskData, resetTaskCreation, setStartDate, setStartTime, setDeadline } = useTaskCreation();
    const { setSelected } = useTasks();
    const { openModal } = useCreateModal();
    const { setIsDrawerOpen } = useDrawer();
    const params = useLocalSearchParams();

    // Check if we should default to Calendar view based on navigation params
    const initialTab = params.workspace === "Calendar" ? "Calendar" : "List";

    // State
    const [selectedTaskForScheduling, setSelectedTaskForScheduling] = useState<any>(null);
    const [schedulingType, setSchedulingType] = useState<'deadline' | 'startDate'>('deadline');

    // Drag-to-create state
    const [showScheduleSheet, setShowScheduleSheet] = useState(false);
    const [scheduleTimeRange, setScheduleTimeRange] = useState<ScheduleTimeRange | null>(null);

    const [centerDate, setCenterDate] = useState(() => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    });
    const [selectedDate, setSelectedDate] = useState(centerDate);
    const [activeTab, setActiveTab] = useState(initialTab);
    const [shouldRenderCalendar, setShouldRenderCalendar] = useState(initialTab === "Calendar");

    // Defer Calendar view rendering until after interactions complete
    useEffect(() => {
        if (activeTab === "Calendar") {
            // Use InteractionManager to defer heavy rendering
            const handle = InteractionManager.runAfterInteractions(() => {
                setShouldRenderCalendar(true);
            });
            return () => handle.cancel();
        }
    }, [activeTab]);

    // Shared Value for Scroll Logic (List View)
    const animatedScrollY = useSharedValue(0);

    // Shared Value for Calendar View Scroll Logic
    const calendarAnimatedScrollY = useSharedValue(0);
    const calendarScrollViewRef = useAnimatedRef<Animated.ScrollView>();

    // Custom Hook for Data Logic
    const {
        tasksForSelectedDate,
        tasksUnscheduled,
        listUnscheduledTasks,
        upcomingTasks,
        pastTasks,
        overdueTasks,
    } = useDailyTasks(selectedDate);

    // Handlers
    const handleDateChange = (date: Date) => {
        setSelectedDate(date);

        // Check if the new date is outside the current page window
        // Current page shows dates from centerDate to centerDate + PAGE_SIZE (6 days)
        const PAGE_SIZE = 6;
        const pageStart = new Date(centerDate);
        const pageEnd = new Date(centerDate);
        pageEnd.setDate(centerDate.getDate() + PAGE_SIZE - 1);

        // If date is before the current page, shift center back
        if (date < pageStart) {
            const newCenter = new Date(date);
            newCenter.setHours(0, 0, 0, 0);
            setCenterDate(newCenter);
        }
        // If date is after the current page, shift center forward
        else if (date > pageEnd) {
            const newCenter = new Date(date);
            newCenter.setHours(0, 0, 0, 0);
            setCenterDate(newCenter);
        }
    };

    const handlePageChange = (direction: "prev" | "next") => {
        const newCenter = new Date(centerDate);
        if (direction === "next") {
            newCenter.setDate(centerDate.getDate() + 6); // PAGE_SIZE = 6
        } else {
            newCenter.setDate(centerDate.getDate() - 6);
        }
        setCenterDate(newCenter);
    };

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

    const handleDragCreateComplete = useCallback((range: ScheduleTimeRange) => {
        setScheduleTimeRange(range);
        setShowScheduleSheet(true);
    }, []);

    const handleCreateNewFromRange = useCallback((startTime: Date, endTime: Date, workspaceName: string) => {
        resetTaskCreation();
        setSelected(workspaceName);
        setStartDate(selectedDate);
        setStartTime(startTime);
        setDeadline(endTime);
        setTimeout(() => openModal({ screen: Screen.STANDARD }), 300);
    }, [selectedDate, resetTaskCreation, setSelected, setStartDate, setStartTime, setDeadline, openModal]);

    const listScrollHandler = useAnimatedScrollHandler({
        onScroll: (event) => {
            animatedScrollY.value = event.contentOffset.y;
        },
    });

    const renderHeader = () => (
        <View style={{  marginBottom: 12 }}>
            <DailyHeader
                onOpenDrawer={() => drawerRef.current?.openDrawer()}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                selectedDate={selectedDate}
            />
            {/* <DatePager
                centerDate={centerDate}
                selectedDate={selectedDate}
                onDateSelected={handleDateChange}
                onPageChange={handlePageChange}
                setCenterDate={setCenterDate}
            /> */}
        </View>
    );

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

            <View style={[styles.container, { flex: 1, paddingTop: insets.top, backgroundColor: ThemedColor.background }]}>
                {renderHeader()}

                <AnimatedTabContent activeTab={activeTab === "List" ? 0 : 1} setActiveTab={(i) => setActiveTab(i === 0 ? "List" : "Calendar")} flex>
                    <Animated.ScrollView
                        ref={scrollViewRef}
                        style={{ flex: 1 }}
                        showsVerticalScrollIndicator={false}
                        onScroll={listScrollHandler}
                        scrollEventThrottle={16}
                        removeClippedSubviews={true}
                        contentContainerStyle={{ paddingBottom: 128 }}>
                        <TaskListView
                            selectedDate={selectedDate}
                            tasksForSelectedDate={tasksForSelectedDate}
                            overdueTasks={overdueTasks}
                            upcomingTasks={upcomingTasks}
                            pastTasks={pastTasks}
                            unscheduledTasks={listUnscheduledTasks}
                            onQuickSchedule={handleQuickSchedule}
                        />
                    </Animated.ScrollView>
                    <View style={{ flex: 1 }}>
                        {shouldRenderCalendar && (
                            <CalendarView
                                selectedDate={selectedDate}
                                animatedScrollY={calendarAnimatedScrollY}
                                scrollViewRef={calendarScrollViewRef}
                                onDragCreateComplete={handleDragCreateComplete}
                            />
                        )}
                    </View>
                </AnimatedTabContent>

                <FloatingDateNav
                    selectedDate={selectedDate}
                    onDateChange={handleDateChange}
                />

                <ScheduleTaskSheet
                    visible={showScheduleSheet}
                    setVisible={setShowScheduleSheet}
                    timeRange={scheduleTimeRange}
                    selectedDate={selectedDate}
                    tasksUnscheduled={tasksUnscheduled}
                    onCreateNew={handleCreateNewFromRange}
                />
            </View>
        </DrawerLayout>
    );
};

export default Daily;

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
});
