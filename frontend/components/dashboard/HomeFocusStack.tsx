import React, { useMemo, useRef, useState } from "react";
import { View, Pressable, TouchableOpacity, StyleSheet, Platform, Image, useColorScheme, ActionSheetIOS, Alert } from "react-native";
import type { SharedValue } from "react-native-reanimated";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { ArrowRight, CalendarBlank, CaretLeft, Check, ClipboardText, EyeSlash, ListChecks, Play } from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useTaskActions, useTasks } from "@/contexts/tasksContext";
import { markInProgressAPI, setWorkingAPI, updateTaskStartAPI } from "@/api/task";
import { clearTaskSomedayAPI } from "@/api/plan";
import { openPlanSheet } from "@/hooks/planSheetStore";
import { isSomedayTask } from "@/hooks/useSomedayTasks";
import { hideStageTask, useHiddenStageTasks } from "@/hooks/useHiddenStageTasks";
import { showToast } from "@/utils/showToast";
import { HIDE_HOURS, hoursLeft } from "@/utils/stageHidden";
import { ASSIGN_OPTIONS, assignDate, type AssignKey } from "@/utils/somedayAssign";
import { ActiveTaskActivityFactory } from "@/widgets/widgetUpdaters";
import { hapticSelect } from "@/utils/haptics";
import { useTaskCompletion } from "@/hooks/useTaskCompletion";
import { useRecentKudos, type StageKudos } from "@/hooks/useRecentKudos";
import type { StageTask } from "@/hooks/useHomeStageQueue";
import { SwipeCardStack, type SwipeCardStackHandle } from "@/components/ui/SwipeCardStack";

export type StageItem = { kind: "task"; task: StageTask } | { kind: "kudos"; kudos: StageKudos };

const CARD_HEIGHT = 156;

const itemKey = (item: StageItem) => (item.kind === "task" ? item.task.id : `kudos-${item.kudos.id}`);

const openTask = (task: StageTask) =>
    router.push({
        pathname: "/(logged-in)/(tabs)/(task)/task/[id]",
        params: { name: task.content, id: task.id, categoryId: task.categoryID },
    });

type Props = {
    queue: StageTask[];
    /** drives the spill into a list; the home page fades its other content off the same value */
    spill: SharedValue<number>;
    onListedChange: (listed: boolean) => void;
    /** room below the top of this component for the spilled list */
    availableHeight: number;
    /** quick actions (calendar, tidy up) that sit beside View all */
    accessory?: React.ReactNode;
};

// Focus stage on mobile: a swipeable card stack of everything on your plate (kudos trail the tasks).
export default function HomeFocusStack({ queue, spill, onListedChange, availableHeight, accessory }: Props) {
    const ThemedColor = useThemeColor();
    const isDark = useColorScheme() === "dark";
    const insets = useSafeAreaInsets();
    const { kudos, acknowledge } = useRecentKudos();
    const { hidden, count: hiddenCount, show, showAll } = useHiddenStageTasks();
    const { allTasks } = useTasks();
    const [current, setCurrent] = useState(0);
    const [listed, setListed] = useState(false);
    const [stackTop, setStackTop] = useState(0);
    const stackRef = useRef<SwipeCardStackHandle>(null);

    const items = useMemo<StageItem[]>(
        () => [...queue.map((task): StageItem => ({ kind: "task", task })), ...kudos.map((k): StageItem => ({ kind: "kudos", kudos: k }))],
        [queue, kudos]
    );
    const n = items.length;

    const handleListed = (value: boolean) => {
        setListed(value);
        onListedChange(value);
    };

    const toggle = (
        <TouchableOpacity onPress={() => stackRef.current?.collapse()} hitSlop={8} style={styles.footer}>
            <ThemedText type="caption" style={{ color: ThemedColor.primary }}>
                Show as stack
            </ThemedText>
        </TouchableOpacity>
    );

    return (
        <View style={styles.wrap}>
            {n === 0 ? (
                <View
                    style={[
                        styles.emptyCard,
                        { backgroundColor: isDark ? ThemedColor.lightened : ThemedColor.background, borderColor: ThemedColor.tertiary },
                    ]}>
                    <Image
                        source={require("@/assets/images/211-Coffee.png")}
                        style={[styles.emptyImage, isDark && { tintColor: "#ffffff" }]}
                        resizeMode="contain"
                    />
                    <View style={styles.emptyText}>
                        <ThemedText type="subtitle">Relax and enjoy the break</ThemedText>
                        <ThemedText type="caption">
                            {hiddenCount > 0 ? "Everything left is hidden for now. Bring it back below." : "Nothing on your plate. Add something below."}
                        </ThemedText>
                    </View>
                </View>
            ) : (
                <View style={{ width: "100%" }} onLayout={(e) => setStackTop(e.nativeEvent.layout.y)}>
                    <SwipeCardStack
                        ref={stackRef}
                        items={items}
                        keyOf={itemKey}
                        cardHeight={CARD_HEIGHT}
                        frontColor={isDark ? ThemedColor.lightened : ThemedColor.background}
                        backColor={ThemedColor.lightened}
                        onIndexChange={setCurrent}
                        spill={spill}
                        onListedChange={handleListed}
                        listHeight={availableHeight - stackTop}
                        listBottomPadding={insets.bottom + 48}
                        listFooter={toggle}
                        renderCard={(item) =>
                            item.kind === "task" ? (
                                <TaskBody task={item.task} />
                            ) : (
                                <KudosBody kudos={item.kudos} onAcknowledge={acknowledge} />
                            )
                        }
                    />
                </View>
            )}

            {(n > 1 || accessory) && !listed && (
                <View style={styles.footer}>
                    {n > 1 && (
                        <>
                            <TouchableOpacity onPress={() => stackRef.current?.prev()} hitSlop={10} accessibilityLabel="Previous card">
                                <CaretLeft size={14} color={ThemedColor.caption} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => stackRef.current?.next()} hitSlop={8} accessibilityLabel="Next card">
                                <ThemedText type="caption" style={{ fontVariant: ["tabular-nums"] }}>
                                    {current + 1} of {n}
                                </ThemedText>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => stackRef.current?.expand()} hitSlop={8}>
                                <ThemedText type="caption" style={{ color: ThemedColor.primary }}>
                                    View all
                                </ThemedText>
                            </TouchableOpacity>
                        </>
                    )}
                    {accessory}
                </View>
            )}

            {hiddenCount > 0 && !listed && (
                <HiddenChip hidden={hidden} allTasks={allTasks} onShow={show} onShowAll={showAll} />
            )}
        </View>
    );
}

// Where hidden tasks went: a quiet chip under the stack that says when they return and brings them back.
function HiddenChip({
    hidden,
    allTasks,
    onShow,
    onShowAll,
}: {
    hidden: Record<string, string>;
    allTasks: { id: string; content: string }[];
    onShow: (id: string) => void;
    onShowAll: () => void;
}) {
    const ThemedColor = useThemeColor();
    const ids = Object.keys(hidden);
    const now = Date.now();
    const soonest = Math.min(...ids.map((id) => hoursLeft(hidden[id], now)));
    const nameOf = (id: string) => allTasks.find((t) => t.id === id)?.content ?? "Hidden task";

    const open = () => {
        hapticSelect();
        const shown = ids.slice(0, 4);
        const labels = [...shown.map((id) => `Show "${nameOf(id)}"`), ...(ids.length > 1 ? [`Show all ${ids.length}`] : []), "Cancel"];
        const run = (i: number) => {
            if (i < shown.length) onShow(shown[i]);
            else if (ids.length > 1 && i === shown.length) onShowAll();
        };
        if (Platform.OS === "ios") {
            ActionSheetIOS.showActionSheetWithOptions(
                { title: `Hidden for ${HIDE_HOURS} hours`, options: labels, cancelButtonIndex: labels.length - 1 },
                run
            );
        } else {
            // Android alerts hold three buttons: show everything
            Alert.alert(`Hidden for ${HIDE_HOURS} hours`, `${ids.length} hidden. Back in about ${soonest}h.`, [
                { text: "Show all", onPress: onShowAll },
                { text: "Cancel", style: "cancel" },
            ]);
        }
    };

    return (
        <TouchableOpacity
            onPress={open}
            activeOpacity={0.7}
            hitSlop={8}
            accessibilityLabel={`${ids.length} hidden tasks. Tap to show.`}
            style={[styles.hiddenChip, { backgroundColor: ThemedColor.primary + "14" }]}>
            <EyeSlash size={14} color={ThemedColor.primary} />
            <ThemedText type="smallerDefault" style={{ color: ThemedColor.primary }}>
                {ids.length} hidden · back in {soonest}h
            </ThemedText>
        </TouchableOpacity>
    );
}

function TaskBody({ task }: { task: StageTask }) {
    const ThemedColor = useThemeColor();
    const { updateTask } = useTaskActions();
    const { markTaskAsCompleted, isCompleting } = useTaskCompletion();
    const working = !!(task.active || task.workingOnSince);
    const priorityColor =
        task.priority === 3
            ? ThemedColor.error
            : task.priority === 2
              ? ThemedColor.warning
              : task.priority === 1
                ? ThemedColor.success
                : undefined;
    const caption = [task.reason, task.workspaceName].filter(Boolean).join(" · ");
    const someday = isSomedayTask(task);

    const hide = () => {
        hapticSelect();
        hideStageTask(task.id);
        showToast(`Hidden for ${HIDE_HOURS} hours. Find it under "hidden" below the stack.`, "info");
    };

    // Give a Someday task a day: it leaves Someday and shows up on that day
    const assign = (key: AssignKey) => {
        const at = assignDate(key);
        const iso = at.toISOString();
        const prev = { startDate: task.startDate ?? null, startTime: task.startTime ?? null, somedayAt: task.somedayAt ?? null };
        updateTask(task.categoryID, task.id, { startDate: iso, startTime: iso, somedayAt: null });
        Promise.all([updateTaskStartAPI(task.categoryID, task.id, at, at), clearTaskSomedayAPI(task.categoryID, task.id)]).then(
            () => showToast(`Scheduled for ${ASSIGN_OPTIONS.find((o) => o.key === key)?.label.toLowerCase()}`, "success"),
            () => {
                updateTask(task.categoryID, task.id, prev);
                showToast("Couldn't set that day. Give it another try.", "danger");
            }
        );
    };

    const pickDay = () => {
        hapticSelect();
        if (Platform.OS === "ios") {
            const labels = [...ASSIGN_OPTIONS.map((o) => o.label), "Choose in the task", "Cancel"];
            ActionSheetIOS.showActionSheetWithOptions(
                { title: "When do you want to do this?", options: labels, cancelButtonIndex: labels.length - 1 },
                (i) => {
                    if (i < ASSIGN_OPTIONS.length) assign(ASSIGN_OPTIONS[i].key);
                    else if (i === ASSIGN_OPTIONS.length) openTask(task);
                }
            );
        } else {
            Alert.alert("When do you want to do this?", undefined, [
                { text: "Tomorrow", onPress: () => assign("tomorrow") },
                { text: "Next week", onPress: () => assign("nextWeek") },
                { text: "Choose in the task", onPress: () => openTask(task) },
            ]);
        }
    };

    const start = () => {
        if (Platform.OS === "ios") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const now = new Date().toISOString();
        ActiveTaskActivityFactory.start({
            taskName: task.content,
            workspaceName: task.workspaceName || "Tasks",
            startTime: now,
            endTime: task.deadline || undefined,
            hasEndTime: !!task.deadline,
            categoryId: task.categoryID,
            taskId: task.id,
        });
        updateTask(task.categoryID, task.id, { workingOnSince: now, active: true });
        setWorkingAPI(task.categoryID, task.id, true).catch(() => {});
        markInProgressAPI(task.categoryID, task.id).catch(() => {});
    };

    const complete = () => {
        if (Platform.OS === "ios") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (task.workingOnSince) {
            ActiveTaskActivityFactory.getInstances().forEach((a) => a.end("default"));
            setWorkingAPI(task.categoryID, task.id, false).catch(() => {});
        }
        markTaskAsCompleted(task.categoryID, task.id, { id: task.id, content: task.content, value: task.value ?? 0 });
    };

    // Quiet complete: for a task that's already done in real life, no timer/confetti ceremony.
    const log = () => {
        hapticSelect();
        if (task.workingOnSince) {
            ActiveTaskActivityFactory.getInstances().forEach((a) => a.end("default"));
            setWorkingAPI(task.categoryID, task.id, false).catch(() => {});
        }
        markTaskAsCompleted(
            task.categoryID,
            task.id,
            { id: task.id, content: task.content, value: task.value ?? 0 },
            undefined,
            { skipConfetti: true }
        );
    };

    return (
        <Pressable onPress={() => openTask(task)} style={styles.cardInner} accessibilityRole="link">
            <View style={{ gap: 4 }}>
                <View style={styles.captionRow}>
                    <ThemedText type="caption" numberOfLines={1} style={{ flex: 1 }}>
                        {caption}
                    </ThemedText>
                    <TouchableOpacity
                        onPress={hide}
                        hitSlop={10}
                        activeOpacity={0.6}
                        accessibilityLabel={`Hide for ${HIDE_HOURS} hours`}>
                        <EyeSlash size={16} color={ThemedColor.caption} />
                    </TouchableOpacity>
                </View>
                <View style={styles.titleRow}>
                    {(working || priorityColor) && (
                        <View style={[styles.dot, { backgroundColor: working ? ThemedColor.primary : priorityColor }]} />
                    )}
                    <ThemedText type="subtitle" numberOfLines={2} style={{ flex: 1 }}>
                        {task.content}
                    </ThemedText>
                </View>
            </View>
            {someday ? (
                <View style={styles.actions}>
                    <TouchableOpacity
                        onPress={pickDay}
                        activeOpacity={0.8}
                        style={[styles.action, { backgroundColor: ThemedColor.primary }]}
                        accessibilityLabel="Pick a day">
                        <CalendarBlank size={14} color="#fff" weight="bold" />
                        <ThemedText type="defaultSemiBold" style={styles.actionText}>
                            Pick a day
                        </ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => openPlanSheet({ task })}
                        activeOpacity={0.8}
                        style={[styles.action, { backgroundColor: ThemedColor.primary + "14" }]}
                        accessibilityLabel="Give it a first step">
                        <ListChecks size={14} color={ThemedColor.primary} weight="bold" />
                        <ThemedText type="defaultSemiBold" style={[styles.actionText, { color: ThemedColor.primary }]}>
                            First step
                        </ThemedText>
                    </TouchableOpacity>
                </View>
            ) : (
            <View style={styles.actions}>
                <TouchableOpacity
                    onPress={log}
                    disabled={isCompleting}
                    activeOpacity={0.7}
                    hitSlop={8}
                    style={styles.logAction}
                    accessibilityLabel="Log as already done">
                    <ClipboardText size={14} color={ThemedColor.caption} />
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={complete}
                    disabled={isCompleting}
                    activeOpacity={0.8}
                    style={[styles.action, { backgroundColor: ThemedColor.primary + "14" }]}
                    accessibilityLabel="Mark complete">
                    <Check size={14} color={ThemedColor.primary} weight="bold" />
                    <ThemedText type="defaultSemiBold" style={[styles.actionText, { color: ThemedColor.primary }]}>
                        Done
                    </ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={working ? () => openTask(task) : start}
                    activeOpacity={0.8}
                    style={[styles.action, { backgroundColor: ThemedColor.primary }]}
                    accessibilityLabel={working ? "Open task" : "Start task"}>
                    {working ? (
                        <ArrowRight size={14} color="#fff" weight="bold" />
                    ) : (
                        <Play size={14} color="#fff" weight="fill" />
                    )}
                    <ThemedText type="defaultSemiBold" style={styles.actionText}>
                        {working ? "Open" : "Start"}
                    </ThemedText>
                </TouchableOpacity>
            </View>
            )}
            {/* Someday cards have no day yet, so they read as an open slot: dashed instead of solid */}
            {someday && (
                <View
                    pointerEvents="none"
                    style={[StyleSheet.absoluteFill, styles.dashed, { borderColor: ThemedColor.text + "33" }]}
                />
            )}
        </Pressable>
    );
}

function KudosBody({ kudos, onAcknowledge }: { kudos: StageKudos; onAcknowledge: (k: StageKudos) => void }) {
    const ThemedColor = useThemeColor();
    const verb = kudos.kudosKind === "congratulation" ? "Congratulated you" : "Cheered you on";
    return (
        <Pressable
            onPress={() => router.push("/(logged-in)/(tabs)/(task)/kudos")}
            style={styles.cardInner}
            accessibilityRole="link">
            <View style={{ gap: 8 }}>
                <ThemedText type="caption" numberOfLines={1}>
                    {verb}
                    {kudos.taskName ? ` for ${kudos.taskName}` : ""}
                </ThemedText>
                <View style={styles.titleRow}>
                    {kudos.sender.picture ? (
                        <Image source={{ uri: kudos.sender.picture }} style={styles.avatar} />
                    ) : (
                        <View style={[styles.avatar, { backgroundColor: ThemedColor.primary }]} />
                    )}
                    <View style={{ flex: 1 }}>
                        <ThemedText type="defaultSemiBold" numberOfLines={1}>
                            {kudos.sender.name}
                        </ThemedText>
                        <ThemedText type="default" numberOfLines={1}>
                            {kudos.message}
                        </ThemedText>
                    </View>
                </View>
            </View>
            <TouchableOpacity
                onPress={() => onAcknowledge(kudos)}
                activeOpacity={0.8}
                style={[styles.action, { backgroundColor: ThemedColor.primary }]}
                accessibilityLabel="Acknowledge kudos">
                <Check size={14} color="#fff" weight="bold" />
                <ThemedText type="defaultSemiBold" style={styles.actionText}>
                    Thanks
                </ThemedText>
            </TouchableOpacity>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    wrap: { width: "100%", alignItems: "center", gap: 12 },
    emptyCard: {
        width: "100%",
        alignItems: "flex-start",
        gap: 4,
        borderRadius: 20,
        borderWidth: StyleSheet.hairlineWidth,
        padding: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.08,
        shadowRadius: 24,
    },
    emptyText: { alignSelf: "stretch", gap: 6 },
    emptyImage: { width: 104, height: 104, alignSelf: "center" },
    footer: { flexDirection: "row", alignItems: "center", alignSelf: "center", gap: 16, paddingVertical: 4 },
    cardInner: { flex: 1, padding: 20, justifyContent: "space-between" },
    titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    avatar: { width: 36, height: 36, borderRadius: 18 },
    actions: { flexDirection: "row", alignItems: "center", gap: 8 },
    captionRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    dashed: { borderWidth: 1.5, borderStyle: "dashed", borderRadius: 20 },
    hiddenChip: {
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "center",
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 100,
    },
    logAction: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
    action: {
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 100,
    },
    actionText: { color: "#fff", fontSize: 15 },
});
