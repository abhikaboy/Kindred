import { Dimensions, StyleSheet, TouchableOpacity, View, InteractionManager } from "react-native";
import React, { useRef, useState, useEffect } from "react";
import { DrawerLayout } from "react-native-gesture-handler";
import { Drawer } from "@/components/home/Drawer";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useTaskCreation } from "@/contexts/taskCreationContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDrawer } from "@/contexts/drawerContext";
import { Screen } from "@/components/modals/CreateModal";
import { useCreateModal } from "@/contexts/createModalContext";
import Animated, {
    useSharedValue,
    useAnimatedScrollHandler,
    useAnimatedRef,
} from "react-native-reanimated";

// Components
import { DailyHeader } from "@/components/daily/DailyHeader";
import { DatePager } from "@/components/daily/DatePager";
import { TaskListView } from "@/components/daily/TaskListView";
import { CalendarView } from "@/components/daily/CalendarView";

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
    const { loadTaskData } = useTaskCreation();
    const { openModal } = useCreateModal();
    const { setIsDrawerOpen } = useDrawer();
    
    // State
    const [selectedTaskForScheduling, setSelectedTaskForScheduling] = useState<any>(null);
    const [schedulingType, setSchedulingType] = useState<'deadline' | 'startDate'>('deadline');
    
    const [centerDate, setCenterDate] = useState(() => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    });
    const [selectedDate, setSelectedDate] = useState(centerDate);
    const [activeTab, setActiveTab] = useState("List");
    const [shouldRenderCalendar, setShouldRenderCalendar] = useState(false);

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
        tasksWithSpecificTime,
        tasksForTodayNoTime,
        tasksUnscheduled,
        listUnscheduledTasks,
        upcomingTasks,
        pastTasks,
        overdueTasks,
    } = useDailyTasks(selectedDate);

    // Handlers
    const handleDateChange = (date: Date) => {
        setSelectedDate(date);
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
            <DatePager 
                centerDate={centerDate}
                selectedDate={selectedDate}
                onDateSelected={handleDateChange}
                onPageChange={handlePageChange}
                setCenterDate={setCenterDate}
            />
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
                <View style={{ flex: 1 }}>
                    {/* List View - Keep mounted but hide when not active */}
                    <View 
                        style={{ 
                            flex: 1, 
                            display: activeTab === "List" ? "flex" : "none" 
                        }}
                        removeClippedSubviews={activeTab !== "List"}
                    >
                        <Animated.ScrollView 
                            ref={scrollViewRef}
                            style={{ flex: 1 }}
                            showsVerticalScrollIndicator={false}
                            onScroll={listScrollHandler}
                            scrollEventThrottle={16}
                            removeClippedSubviews={true}
                            contentContainerStyle={{ paddingBottom: 128 }}>
                            {renderHeader()}
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
                    </View>

                    {/* Calendar View - Lazy render after interaction completes */}
                    <View 
                        style={{ 
                            flex: 1, 
                            display: activeTab === "Calendar" ? "flex" : "none" 
                        }}
                        removeClippedSubviews={activeTab !== "Calendar"}
                    >
                        {shouldRenderCalendar && (
                            <CalendarView 
                                selectedDate={selectedDate}
                                tasksWithSpecificTime={tasksWithSpecificTime}
                                tasksForTodayNoTime={tasksForTodayNoTime}
                                tasksUnscheduled={tasksUnscheduled}
                                animatedScrollY={calendarAnimatedScrollY}
                                scrollViewRef={calendarScrollViewRef}
                                headerContent={renderHeader()}
                            />
                        )}
                    </View>
                </View>
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
