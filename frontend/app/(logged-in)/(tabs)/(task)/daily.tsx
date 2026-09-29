import { StyleSheet, View, InteractionManager } from "react-native";
import * as Haptics from "expo-haptics";
import { DRAWER_WIDTH, HORIZONTAL_PADDING } from "@/constants/spacing";
import React, { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { DrawerLayout } from "react-native-gesture-handler";
import { Drawer } from "@/components/home/Drawer";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useTaskCreationActions } from "@/contexts/taskCreationContext";
import { useTasks } from "@/contexts/tasksContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDrawer } from "@/contexts/drawerContext";
import { Screen } from "@/components/modals/CreateModal";
import { AUTO_CATEGORY_ID } from "@/components/modals/create/Standard";
import { useCreateModal } from "@/contexts/createModalContext";
import { router, useLocalSearchParams } from "expo-router";
import Animated, {
    useSharedValue,
    useAnimatedRef,
    useAnimatedScrollHandler,
} from "react-native-reanimated";

// Components
import { ThemedText } from "@/components/ThemedText";
import { TaskListView } from "@/components/daily/TaskListView";
import { CalendarView, ScheduleTimeRange } from "@/components/daily/CalendarView";
import { TimeSelectionPeek } from "@/components/daily/TimeSelectionPeek";
import PlannerHeader, { PlannerView } from "@/components/daily/PlannerHeader";
import { mondayOf, DropTarget } from "@/components/daily/dayCells";
import MonthGrid from "@/components/daily/MonthGrid";
import WeekAgenda from "@/components/daily/WeekAgenda";
import { PlanDayHeader } from "@/components/daily/WaitingSection";
import StepDoneCelebration from "@/components/plan/StepDoneCelebration";
import WelcomeBackSheet from "@/components/plan/WelcomeBackSheet";
import UnscheduledTray from "@/components/daily/UnscheduledTray";
import HintBubble from "@/components/ui/HintBubble";

// Hooks + utils
import { useDailyTasks } from "@/hooks/useDailyTasks";
import { useFirstTouchHint } from "@/hooks/useFirstTouchHint";
import { useTaskCountsByDay } from "@/hooks/useTaskCountsByDay";
import { fromDayKey } from "@/utils/taskCountsByDay";
import { rectAtPoint, DropRect } from "@/utils/dragHitTest";
import { updateTaskDeadlineAPI, updateTaskStartAPI } from "@/api/task";
import { showToast } from "@/utils/showToast";
import { minutesToDate } from "@/utils/timeUtils";
import { dayKey } from "@/utils/taskCountsByDay";

// Bottom chrome the planner has to clear: the floating tab bar pill, plus the
// pager dots row when embedded in the task-tab pager (see PagerDots).
const TAB_BAR_CLEARANCE = 80;
const PAGER_DOTS_CLEARANCE = 64;

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

type Props = {
    // When embedded (e.g. as a pager page) skip the DrawerLayout wrapper + back button.
    embedded?: boolean;
};

const Daily = ({ embedded }: Props) => {
    const drawerRef = useRef<DrawerLayout>(null);
    const scrollViewRef = useAnimatedRef<Animated.ScrollView>();

    const ThemedColor = useThemeColor();
    const insets = useSafeAreaInsets();
    const { loadTaskData, resetTaskCreation, setStartDate, setStartTime, setDeadline } = useTaskCreationActions();
    const { fetchWorkspaces, updateTask } = useTasks();
    const { openModal } = useCreateModal();
    const { setIsDrawerOpen } = useDrawer();
    const params = useLocalSearchParams();

    // One switcher for the whole planner; deep link workspace===Calendar lands on the day timeline
    const [view, setView] = useState<PlannerView>(params.workspace === "Calendar" ? "day" : "week");
    const [selectedDate, setSelectedDate] = useState(() => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    });
    const weekStart = useMemo(() => mondayOf(selectedDate), [selectedDate]);
    const [monthAnchor, setMonthAnchor] = useState(() => new Date());
    const [shouldRenderCalendar, setShouldRenderCalendar] = useState(view === "day");

    // Scheduling state (kept from previous version)
    const [selectedTaskForScheduling, setSelectedTaskForScheduling] = useState<any>(null);
    const [schedulingType, setSchedulingType] = useState<'deadline' | 'startDate'>('deadline');
    // Live time selection on the timeline. CalendarView owns the ghost block; this mirrors it.
    const [ghostRange, setGhostRange] = useState<ScheduleTimeRange | null>(null);
    const [assigningTaskId, setAssigningTaskId] = useState<string | null>(null);
    const calendarViewRef = useRef<{ clearGhost: () => void }>(null);

    // Defer heavy CalendarView rendering until after interactions complete
    useEffect(() => {
        if (view === "day") {
            const handle = InteractionManager.runAfterInteractions(() => {
                setShouldRenderCalendar(true);
            });
            return () => handle.cancel();
        }
    }, [view]);

    const animatedScrollY = useSharedValue(0);
    const calendarAnimatedScrollY = useSharedValue(0);
    const calendarScrollViewRef = useAnimatedRef<Animated.ScrollView>();


    const {
        tasksForSelectedDate,
        projectedForSelectedDate,
        tasksForTodayNoTime,
        listUnscheduledTasks,
        openTasks,
        overdueTasks,
    } = useDailyTasks(selectedDate);
    const waitingTasks = useMemo(() => [...overdueTasks, ...openTasks], [overdueTasks, openTasks]);

    // A blocked-out time slot can take any of the day's untimed tasks or the backlog
    const peekTasks = useMemo(
        () => [...tasksForTodayNoTime, ...listUnscheduledTasks],
        [tasksForTodayNoTime, listUnscheduledTasks]
    );

    // Per-day dots for the month grid (padded to cover the leading/trailing weeks)
    const rangeStart = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() - 1, 20);
    const rangeEnd = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() + 1, 10);
    const density = useTaskCountsByDay(rangeStart, rangeEnd);

    const isDayView = view === "day";
    const today = new Date();
    const showingToday =
        view === "day"
            ? dayKey(selectedDate) === dayKey(today)
            : view === "week"
              ? weekStart.getTime() === mondayOf(today).getTime()
              : monthAnchor.getMonth() === today.getMonth() && monthAnchor.getFullYear() === today.getFullYear();

    // Header title carries the day too: "September 27", "September 21 – 27"
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const longMonth = (d: Date) => d.toLocaleDateString("en-US", { month: "long" });
    const shortMonth = (d: Date) => d.toLocaleDateString("en-US", { month: "short" });
    const title =
        view === "day"
            ? `${longMonth(selectedDate)} ${selectedDate.getDate()}`
            : view === "week"
              ? weekStart.getMonth() === weekEnd.getMonth()
                  ? `${longMonth(weekStart)} ${weekStart.getDate()} – ${weekEnd.getDate()}`
                  : `${shortMonth(weekStart)} ${weekStart.getDate()} – ${shortMonth(weekEnd)} ${weekEnd.getDate()}`
              : longMonth(monthAnchor);
    const titleYear = (view === "month" ? monthAnchor : view === "week" ? weekStart : selectedDate).getFullYear();

    const goToToday = () => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        setSelectedDate(d);
        setMonthAnchor(d);
    };

    const handleViewChange = (next: PlannerView) => {
        if (next === "month") setMonthAnchor(selectedDate);
        setView(next);
    };

    // Tasks made from the calendar are auto-sorted into a category; the date/time
    // the user picked still rides along on the task
    const handleAddTask = useCallback((date: Date = selectedDate) => {
        resetTaskCreation();
        setStartDate(date);
        openModal({ screen: Screen.STANDARD, categoryId: AUTO_CATEGORY_ID });
    }, [selectedDate, resetTaskCreation, setStartDate, openModal]);

    // Week agenda: the current week opens at today (other weeks open at Monday)
    const dayOffsets = useRef<Map<string, number>>(new Map());
    const landedOnToday = useRef(false);
    const scrollAgendaTo = (y: number) => scrollViewRef.current?.scrollTo({ y: Math.max(0, y - 8), animated: false });
    useEffect(() => {
        // Layout can land before or after this runs, so both paths try to settle it
        const isCurrentWeek = weekStart.getTime() === mondayOf(new Date()).getTime();
        landedOnToday.current = !isCurrentWeek;
        const raf = requestAnimationFrame(() => {
            const y = isCurrentWeek ? dayOffsets.current.get(dayKey(new Date())) : 0;
            if (y !== undefined) {
                landedOnToday.current = true;
                scrollAgendaTo(y);
            }
        });
        return () => cancelAnimationFrame(raf);
    }, [view, weekStart.getTime()]);
    const handleDayLayout = useCallback((key: string, y: number) => {
        dayOffsets.current.set(key, y);
        if (key === dayKey(new Date()) && !landedOnToday.current) {
            landedOnToday.current = true;
            scrollAgendaTo(y);
        }
    }, []);

    // Arrows move by the view's own unit: a day, a week, or a month
    const handleStep = (delta: 1 | -1) => {
        if (view !== "month") {
            const d = new Date(selectedDate);
            d.setDate(d.getDate() + (view === "day" ? 1 : 7) * delta);
            setSelectedDate(d);
        } else {
            setMonthAnchor((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));
        }
    };

    // Drag-to-schedule. Day cells/sections register live targets; they're measured
    // when a drag starts, since the pager and scrolling both move them.
    const dropTargets = useRef<Map<string, DropTarget>>(new Map());
    const dropRects = useRef<DropRect[]>([]);
    const registerDropTarget = useCallback((key: string, target: DropTarget | null) => {
        target ? dropTargets.current.set(key, target) : dropTargets.current.delete(key);
    }, []);

    const [hoverKey, setHoverKey] = useState<string | null>(null);
    const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
    // Chip that follows the finger, in the planner's coordinates
    const containerRef = useRef<View>(null);
    const containerOrigin = useRef({ x: 0, y: 0 });
    const [dragPreview, setDragPreview] = useState<{ task: any; x: number; y: number } | null>(null);
    // Dismissed by the first successful drag-schedule, not by timeout
    const { ready: dragHintReady, done: dragHintDone } = useFirstTouchHint("planner_drag");
    // Timeline's tap-to-block gesture is invisible; first real selection dismisses
    const { ready: timelineHintReady, done: timelineHintDone } = useFirstTouchHint("timeline_drag_create");

    const handleDragStart = useCallback((task: any) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        dropRects.current = [];
        dropTargets.current.forEach((target, key) =>
            target.measureInWindow((x, y, width, height) => dropRects.current.push({ key, x, y, width, height }))
        );
        containerRef.current?.measureInWindow((x, y) => (containerOrigin.current = { x, y }));
        setDragPreview({ task, x: -1000, y: -1000 });
    }, []);

    const handleDragMove = useCallback((x: number, y: number) => {
        const key = rectAtPoint(dropRects.current, x, y);
        setHoverKey((prev) => {
            if (key && key !== prev) Haptics.selectionAsync();
            return key;
        });
        setDragPreview((p) => p && { ...p, x: x - containerOrigin.current.x, y: y - containerOrigin.current.y });
    }, []);

    const handleDragEnd = useCallback(async (task: any, x: number, y: number) => {
        const key = rectAtPoint(dropRects.current, x, y);
        setHoverKey(null);
        setDragPreview(null);
        if (!key) return;
        const date = fromDayKey(key);
        setHiddenIds((prev) => new Set(prev).add(task.id)); // optimistic
        try {
            await updateTaskDeadlineAPI(task.categoryID, task.id, date);
            dragHintDone();
            fetchWorkspaces(true);
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

    const handleGhostRangeChange = useCallback((range: ScheduleTimeRange | null) => {
        if (range) timelineHintDone();
        setGhostRange(range);
    }, [timelineHintDone]);

    const handleAssignToRange = useCallback(async (task: any) => {
        if (!ghostRange || !task.id || !task.categoryID) return;
        const startTime = minutesToDate(selectedDate, ghostRange.startMinutes);
        const endTime = minutesToDate(selectedDate, ghostRange.endMinutes);

        setAssigningTaskId(task.id);
        updateTask(task.categoryID, task.id, {
            startDate: startTime.toISOString(),
            startTime: startTime.toISOString(),
            deadline: endTime.toISOString(),
        });
        try {
            await Promise.all([
                updateTaskStartAPI(task.categoryID, task.id, startTime, startTime),
                updateTaskDeadlineAPI(task.categoryID, task.id, endTime),
            ]);
            calendarViewRef.current?.clearGhost();
        } catch (e) {
            // Leave the selection up so the user can retry
            updateTask(task.categoryID, task.id, {
                startDate: task.startDate || null,
                startTime: task.startTime || null,
                deadline: task.deadline || null,
            });
            showToast("Couldn't schedule task", "danger");
        } finally {
            setAssigningTaskId(null);
        }
    }, [ghostRange, selectedDate, updateTask]);

    const handleCreateNewFromRange = useCallback(() => {
        if (!ghostRange) return;
        resetTaskCreation();
        setStartDate(selectedDate);
        setStartTime(minutesToDate(selectedDate, ghostRange.startMinutes));
        setDeadline(minutesToDate(selectedDate, ghostRange.endMinutes));
        openModal({ screen: Screen.STANDARD, categoryId: AUTO_CATEGORY_ID });
        calendarViewRef.current?.clearGhost();
    }, [ghostRange, selectedDate, resetTaskCreation, setStartDate, setStartTime, setDeadline, openModal]);

    const handleCancelSelection = useCallback(() => {
        calendarViewRef.current?.clearGhost();
    }, []);

    const listScrollHandler = useAnimatedScrollHandler({
        onScroll: (event) => {
            animatedScrollY.value = event.contentOffset.y;
        },
    });

    const bottomClearance = insets.bottom + TAB_BAR_CLEARANCE + (embedded ? PAGER_DOTS_CLEARANCE : 0);
    // The tray/peek float above the tab bar; scroll content pads past whichever is showing
    const [trayH, setTrayH] = useState(0);
    const contentBottom = bottomClearance + trayH + 16;

    const dayCount = tasksForSelectedDate.length;

    const content = (
            <View
                ref={containerRef}
                style={[styles.container, { flex: 1, paddingTop: insets.top, backgroundColor: ThemedColor.background }]}
            >
                <PlannerHeader
                    title={title}
                    year={titleYear}
                    view={view}
                    onViewChange={handleViewChange}
                    onStep={handleStep}
                    onToday={showingToday ? undefined : goToToday}
                    onBack={embedded ? undefined : () => router.back()}
                />

                {view === "month" && (
                    <Animated.ScrollView
                        style={{ flex: 1 }}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingTop: 8, paddingBottom: contentBottom }}>
                        <MonthGrid
                            monthAnchor={monthAnchor}
                            selectedDate={selectedDate}
                            density={density}
                            onSelectDay={setSelectedDate}
                            registerDropTarget={registerDropTarget}
                            hoverKey={hoverKey}
                        />
                        <View style={styles.dayHeader}>
                            <ThemedText type="subtitle">{dayLabel(selectedDate)}</ThemedText>
                            {dayCount > 0 && (
                                <ThemedText type="caption">{`${dayCount} ${dayCount === 1 ? "task" : "tasks"}`}</ThemedText>
                            )}
                        </View>
                        <TaskListView
                            selectedDate={selectedDate}
                            tasksForSelectedDate={tasksForSelectedDate}
                            projectedTasks={projectedForSelectedDate}
                            overdueTasks={overdueTasks}
                            openTasks={openTasks}
                            onAddTask={handleAddTask}
                        />
                    </Animated.ScrollView>
                )}

                {view === "week" && (
                    <>
                        <Animated.ScrollView
                            ref={scrollViewRef}
                            style={{ flex: 1 }}
                            showsVerticalScrollIndicator={false}
                            onScroll={listScrollHandler}
                            scrollEventThrottle={16}
                            contentContainerStyle={{ paddingTop: 8, paddingBottom: contentBottom }}>
                            <WeekAgenda
                                weekStart={weekStart}
                                overdueTasks={overdueTasks}
                                onAddTask={handleAddTask}
                                onDayLayout={handleDayLayout}
                                registerDropTarget={registerDropTarget}
                                hoverKey={hoverKey}
                            />
                        </Animated.ScrollView>
                    </>
                )}

                {view === "day" && (
                    <>
                        <View style={{ flex: 1 }}>
                            {timelineHintReady && (
                                <View style={{ paddingHorizontal: HORIZONTAL_PADDING, paddingBottom: 8 }}>
                                    <HintBubble
                                        text="Tap an empty slot to block out time"
                                        onDone={timelineHintDone}
                                        autoDismissMs={7000}
                                    />
                                </View>
                            )}
                            {shouldRenderCalendar && (
                                <CalendarView
                                    ref={calendarViewRef}
                                    selectedDate={selectedDate}
                                    animatedScrollY={calendarAnimatedScrollY}
                                    scrollViewRef={calendarScrollViewRef}
                                    onGhostRangeChange={handleGhostRangeChange}
                                    bottomInset={contentBottom}
                                    onAddAllDay={() => handleAddTask(selectedDate)}
                                    headerContent={<PlanDayHeader selectedDate={selectedDate} waiting={waitingTasks} />}
                                />
                            )}
                        </View>
                    </>
                )}

                <View
                    style={[styles.bottomSheet, { bottom: bottomClearance }]}
                    onLayout={(e) => setTrayH(e.nativeEvent.layout.height)}
                    pointerEvents="box-none"
                >
                    {ghostRange ? (
                        <TimeSelectionPeek
                            range={ghostRange}
                            selectedDate={selectedDate}
                            tasks={peekTasks}
                            assigningTaskId={assigningTaskId}
                            onAssign={handleAssignToRange}
                            onCreateNew={handleCreateNewFromRange}
                            onCancel={handleCancelSelection}
                        />
                    ) : (
                        // Day view skips the tray: tapping a slot offers the same backlog
                        !isDayView && (
                            <UnscheduledTray
                                tasks={listUnscheduledTasks}
                                hiddenIds={hiddenIds}
                                onDragStart={handleDragStart}
                                onDragMove={handleDragMove}
                                onDragEnd={handleDragEnd}
                                onPressChip={(t) => handleQuickSchedule(t, "deadline")}
                                hintVisible={dragHintReady}
                                onHintDone={dragHintDone}
                            />
                        )
                    )}
                </View>

                {dragPreview && (
                    <View
                        pointerEvents="none"
                        style={[
                            styles.dragPreview,
                            {
                                left: dragPreview.x - 64,
                                top: dragPreview.y - 48,
                                backgroundColor: ThemedColor.lightened,
                                borderColor: ThemedColor.primary,
                            },
                        ]}
                    >
                        <ThemedText type="smallerDefault" numberOfLines={1}>
                            {dragPreview.task.content}
                        </ThemedText>
                    </View>
                )}
                <StepDoneCelebration />
                <WelcomeBackSheet waiting={waitingTasks} />
            </View>
    );

    if (embedded) return content;

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
            {content}
        </DrawerLayout>
    );
};

export default Daily;

// Memoized for the task-tab pager so a swipe elsewhere doesn't re-render the planner
export const MemoDaily = React.memo(Daily);

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    dayHeader: {
        flexDirection: "row",
        alignItems: "baseline",
        justifyContent: "space-between",
        paddingHorizontal: HORIZONTAL_PADDING,
        paddingTop: 12,
        paddingBottom: 8,
    },
    bottomSheet: {
        position: "absolute",
        left: 0,
        right: 0,
    },
    dragPreview: {
        position: "absolute",
        maxWidth: 180,
        borderWidth: 1,
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 8,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
        elevation: 8,
    },
});
