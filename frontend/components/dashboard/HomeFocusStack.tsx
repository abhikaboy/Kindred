import React, { useMemo, useRef, useState } from "react";
import { View, Pressable, TouchableOpacity, StyleSheet, Platform, Image, useColorScheme } from "react-native";
import type { SharedValue } from "react-native-reanimated";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { ArrowRight, CaretLeft, Check, ClipboardText, Play } from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useTaskActions } from "@/contexts/tasksContext";
import { markInProgressAPI, setWorkingAPI } from "@/api/task";
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

// Focus stage on mobile: a swipeable card stack of everything on your plate (kudos lead).
export default function HomeFocusStack({ queue, spill, onListedChange, availableHeight, accessory }: Props) {
    const ThemedColor = useThemeColor();
    const isDark = useColorScheme() === "dark";
    const insets = useSafeAreaInsets();
    const { kudos, acknowledge } = useRecentKudos();
    const [current, setCurrent] = useState(0);
    const [listed, setListed] = useState(false);
    const [stackTop, setStackTop] = useState(0);
    const stackRef = useRef<SwipeCardStackHandle>(null);

    const items = useMemo<StageItem[]>(
        () => [...kudos.map((k): StageItem => ({ kind: "kudos", kudos: k })), ...queue.map((task): StageItem => ({ kind: "task", task }))],
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
                        <ThemedText type="caption">Nothing on your plate. Add something below.</ThemedText>
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
        </View>
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
                {!!caption && (
                    <ThemedText type="caption" numberOfLines={1}>
                        {caption}
                    </ThemedText>
                )}
                <View style={styles.titleRow}>
                    {(working || priorityColor) && (
                        <View style={[styles.dot, { backgroundColor: working ? ThemedColor.primary : priorityColor }]} />
                    )}
                    <ThemedText type="subtitle" numberOfLines={2} style={{ flex: 1 }}>
                        {task.content}
                    </ThemedText>
                </View>
            </View>
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
