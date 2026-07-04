import { StyleSheet, View, TouchableOpacity, InteractionManager } from "react-native";
import { DRAWER_WIDTH, HORIZONTAL_PADDING } from "@/constants/spacing";
import React, { useRef, useState, useEffect, useCallback, useMemo } from "react";
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
import AsyncStorage from "@react-native-async-storage/async-storage";
import Animated, {
    useSharedValue,
    useAnimatedScrollHandler,
    useAnimatedRef,
} from "react-native-reanimated";

// Components
import { ThemedText } from "@/components/ThemedText";
import { TaskListView } from "@/components/daily/TaskListView";
import { CalendarView, ScheduleTimeRange } from "@/components/daily/CalendarView";
import { ScheduleTaskSheet } from "@/components/daily/ScheduleTaskSheet";
import PlannerHeader from "@/components/daily/PlannerHeader";
import WeekStrip, { mondayOf, DropRectValue } from "@/components/daily/WeekStrip";
import MonthGrid from "@/components/daily/MonthGrid";
import UnscheduledTray from "@/components/daily/UnscheduledTray";

// Hooks + utils
import { useDailyTasks } from "@/hooks/useDailyTasks";
import { useTaskCountsByDay } from "@/hooks/useTaskCountsByDay";
import { fromDayKey } from "@/utils/taskCountsByDay";
import { rectAtPoint } from "@/utils/dragHitTest";
import { updateTaskDeadlineAPI } from "@/api/task";
import { showToast } from "@/utils/showToast";

const dayLabel = (date: Date): string => {
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const selected = startOfDay(date);
    const today = startOfDay(new Date());
    const oneDay = 24 * 60 * 60 * 1000;

    if (selected === today) return "Today";
    if (selected === today + oneDay) return "Tomorrow";
    if (selected === today - oneDay) return "Yesterday";

    return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
};

type Props = {};

const Daily = (props: Props) => {
    const drawerRef = useRef<DrawerLayout>(null);
    const scrollViewRef = useAnimatedRef<Animated.ScrollView>();

    const ThemedColor = useThemeColor();
    const insets = useSafeAreaInsets();
    const { loadTaskData, resetTaskCreation, setStartDate, setStartTime, setDeadline } = useTaskCreation();
    const { setSelected, fetchWorkspaces } = useTasks();
    const { openModal } = useCreateModal();
    const { setIsDrawerOpen } = useDrawer();
    const params = useLocalSearchParams();

    // View state — week-first; deep link workspace===Calendar lands on the timeline
    const [viewMode, setViewMode] = useState<"week" | "month">("week");
    const [dayDetail, setDayDetail] = useState<"agenda" | "timeline">(
        params.workspace === "Calendar" ? "timeline" : "agenda"
    );
    const [selectedDate, setSelectedDate] = useState(() => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    });
    const weekStart = useMemo(() => mondayOf(selectedDate), [selectedDate]);
    const [monthAnchor, setMonthAnchor] = useState(() => new Date());
    const [shouldRenderCalendar, setShouldRenderCalendar] = useState(dayDetail === "timeline");

    // Scheduling state (kept from previous version)
    const [selectedTaskForScheduling, setSelectedTaskForScheduling] = useState<any>(null);
    const [schedulingType, setSchedulingType] = useState<'deadline' | 'startDate'>('deadline');
    const [showScheduleSheet, setShowScheduleSheet] = useState(false);
    const [scheduleTimeRange, setScheduleTimeRange] = useState<ScheduleTimeRange | null>(null);

    // Defer heavy CalendarView rendering until after interactions complete
    useEffect(() => {
        if (dayDetail === "timeline") {
            const handle = InteractionManager.runAfterInteractions(() => {
                setShouldRenderCalendar(true);
            });
            return () => handle.cancel();
        }
    }, [dayDetail]);

    const animatedScrollY = useSharedValue(0);
    const calendarAnimatedScrollY = useSharedValue(0);
    const calendarScrollViewRef = useAnimatedRef<Animated.ScrollView>();

    const {
        tasksForSelectedDate,
        tasksUnscheduled,
        listUnscheduledTasks,
        upcomingTasks,
        openTasks,
        overdueTasks,
    } = useDailyTasks(selectedDate);

    // Density for whichever range is on screen (month range padded to cover grid edges)
    const rangeStart = viewMode === "week"
        ? weekStart
        : new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() - 1, 20);
    const rangeEnd = viewMode === "week"
        ? (() => { const d = new Date(weekStart); d.setDate(d.getDate() + 6); return d; })()
        : new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() + 1, 10);
    const density = useTaskCountsByDay(rangeStart, rangeEnd);

    const handleStep = (delta: 1 | -1) => {
        if (viewMode === "week") {
            const d = new Date(selectedDate);
            d.setDate(d.getDate() + 7 * delta);
            setSelectedDate(d);
        } else {
            setMonthAnchor((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));
        }
    };

    // Drag-to-schedule
    const dropRects = useRef<Map<string, DropRectValue>>(new Map());
    const registerDropRect = useCallback((key: string, rect: DropRectValue | null) => {
        rect ? dropRects.current.set(key, rect) : dropRects.current.delete(key);
    }, []);
    useEffect(() => {
        dropRects.current.clear();
    }, [viewMode, weekStart.getTime(), monthAnchor.getTime()]);

    const [hoverKey, setHoverKey] = useState<string | null>(null);
    const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
    const [hintDone, setHintDone] = useState(true);
    useEffect(() => {
        AsyncStorage.getItem("planner_drag_hint_done").then((v) => setHintDone(v === "1"));
    }, []);

    const rectsArray = () => Array.from(dropRects.current, ([key, r]) => ({ key, ...r }));

    const handleDragMove = useCallback((x: number, y: number) => {
        setHoverKey(rectAtPoint(rectsArray(), x, y));
    }, []);

    const handleDragEnd = useCallback(async (task: any, x: number, y: number) => {
        const key = rectAtPoint(rectsArray(), x, y);
        setHoverKey(null);
        if (!key) return;
        const date = fromDayKey(key);
        setHiddenIds((prev) => new Set(prev).add(task.id)); // optimistic
        try {
            await updateTaskDeadlineAPI(task.categoryID, task.id, date);
            AsyncStorage.setItem("planner_drag_hint_done", "1");
            setHintDone(true);
            fetchWorkspaces();
        } catch (e) {
            setHiddenIds((prev) => {
                const n = new Set(prev);
                n.delete(task.id);
                return n;
            });
            showToast("Couldn't schedule task", "danger");
        }
    }, [fetchWorkspaces]);

    // Kept handlers
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

    return (
        <DrawerLayout
            ref={drawerRef}
            hideStatusBar
            edgeWidth={50}
            drawerWidth={DRAWER_WIDTH}
            renderNavigationView={() => <Drawer close={drawerRef.current?.closeDrawer} />}
            drawerPosition="left"
            drawerType="front"
            onDrawerOpen={() => setIsDrawerOpen(true)}
            onDrawerClose={() => setIsDrawerOpen(false)}>

            <View style={[styles.container, { flex: 1, paddingTop: insets.top, backgroundColor: ThemedColor.background }]}>
                <PlannerHeader
                    anchorDate={viewMode === "week" ? selectedDate : monthAnchor}
                    mode={viewMode}
                    onStep={handleStep}
                    onModeChange={setViewMode}
                />

                {viewMode === "week" ? (
                    <>
                        <WeekStrip
                            weekStart={weekStart}
                            selectedDate={selectedDate}
                            onSelectDate={setSelectedDate}
                            density={density}
                            registerDropRect={registerDropRect}
                            hoverKey={hoverKey}
                        />
                        <View style={styles.dayHeader}>
                            <ThemedText type="defaultSemiBold">{dayLabel(selectedDate)}</ThemedText>
                            <TouchableOpacity
                                onPress={() => setDayDetail(dayDetail === "agenda" ? "timeline" : "agenda")}
                                hitSlop={8}
                            >
                                <ThemedText type="caption" style={{ color: ThemedColor.primary }}>
                                    {dayDetail === "agenda" ? "◷ Timeline" : "☰ Agenda"}
                                </ThemedText>
                            </TouchableOpacity>
                        </View>
                        {dayDetail === "agenda" ? (
                            <Animated.ScrollView
                                ref={scrollViewRef}
                                style={{ flex: 1 }}
                                showsVerticalScrollIndicator={false}
                                onScroll={listScrollHandler}
                                scrollEventThrottle={16}
                                removeClippedSubviews={true}
                                contentContainerStyle={{ paddingTop: 8, paddingBottom: 32 }}>
                                <TaskListView
                                    selectedDate={selectedDate}
                                    tasksForSelectedDate={tasksForSelectedDate}
                                    overdueTasks={overdueTasks}
                                    upcomingTasks={upcomingTasks}
                                    openTasks={openTasks}
                                    unscheduledTasks={listUnscheduledTasks}
                                    onQuickSchedule={handleQuickSchedule}
                                />
                            </Animated.ScrollView>
                        ) : (
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
                        )}
                    </>
                ) : (
                    <View style={{ flex: 1 }}>
                        <MonthGrid
                            monthAnchor={monthAnchor}
                            density={density}
                            onSelectDay={(d) => {
                                setSelectedDate(d);
                                setViewMode("week");
                            }}
                            registerDropRect={registerDropRect}
                            hoverKey={hoverKey}
                        />
                    </View>
                )}

                <UnscheduledTray
                    tasks={tasksUnscheduled}
                    hiddenIds={hiddenIds}
                    onDragStart={() => {}}
                    onDragMove={handleDragMove}
                    onDragEnd={handleDragEnd}
                    onPressChip={(t) => handleQuickSchedule(t, "deadline")}
                    hintVisible={!hintDone}
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
    dayHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: HORIZONTAL_PADDING,
        paddingTop: 10,
        paddingBottom: 4,
    },
});
