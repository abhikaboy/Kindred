import React, { useEffect, useState } from "react";
import { View, Pressable, StyleSheet, TouchableOpacity } from "react-native";
import Reanimated, { FadeInDown, FadeOutDown } from "react-native-reanimated";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as PhosphorIcons from "phosphor-react-native";
import { Check, Stop } from "phosphor-react-native";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useTasks } from "@/contexts/tasksContext";
import { useTaskCompletion } from "@/hooks/useTaskCompletion";
import { useActiveTask } from "@/hooks/useActiveTask";
import { activateTaskAPI } from "@/api/task";
import { endActivity } from "@/utils/liveActivityManager";

// Floating tab bar height (matches PagerDots).
const TAB_BAR_HEIGHT = 83;
const BAR_HEIGHT = 56;
/** Vertical room the bar takes, so pages can stack their own docks above it. */
export const ACTIVE_BAR_SPACE = BAR_HEIGHT + 8;

function formatElapsed(ms: number) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const pad = (n: number) => String(n).padStart(2, "0");
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

// Spotify-style mini player for the task you're working on, docked above the tab bar.
export default function ActiveTaskMiniBar({ tabBarHidden }: { tabBarHidden: boolean }) {
    const ThemedColor = useThemeColor();
    const insets = useSafeAreaInsets();
    const current = useActiveTask();
    const { updateTask } = useTasks();
    const { markTaskAsCompleted } = useTaskCompletion();
    const [now, setNow] = useState(() => Date.now());
    const [storedStart, setStoredStart] = useState<number | null>(null);

    const taskId = current?.task.id;
    useEffect(() => {
        setStoredStart(null);
        if (!taskId) return;
        // The detail page's timer persists its start here when workingOnSince isn't set.
        AsyncStorage.getItem(`task_${taskId}_baseTime`).then((v) => v && setStoredStart(Number(v)));
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, [taskId]);

    if (!current) return null;
    const { task, categoryId, categoryName, workspaceName, workspaceIcon } = current;
    const WorkspaceIcon = (workspaceIcon && (PhosphorIcons as any)[workspaceIcon]) || PhosphorIcons.SquaresFour;

    const startMs = task.workingOnSince ? new Date(task.workingOnSince).getTime() : storedStart;
    const deadlineMs = task.deadline ? new Date(task.deadline).getTime() : null;
    const progress = startMs && deadlineMs && deadlineMs > startMs ? Math.min(1, (now - startMs) / (deadlineMs - startMs)) : null;

    const open = () =>
        router.push({
            pathname: "/(logged-in)/(tabs)/(task)/task/[id]",
            params: { name: task.content, id: task.id, categoryId },
        });

    const stop = () => {
        updateTask(categoryId, task.id, { active: false, workingOnSince: undefined });
        endActivity(task.id).catch(() => {});
        activateTaskAPI(categoryId, task.id, false).catch(() => {});
    };

    const finish = () =>
        markTaskAsCompleted(
            categoryId,
            task.id,
            { id: task.id, content: task.content, value: task.value ?? 0, public: task.public },
            categoryName
        );

    const onPrimary = "#FFFFFF";
    return (
        <Reanimated.View
            entering={FadeInDown.duration(220)}
            exiting={FadeOutDown.duration(160)}
            style={[styles.bar, { bottom: insets.bottom + (tabBarHidden ? 8 : TAB_BAR_HEIGHT), backgroundColor: ThemedColor.primary }]}>
            <Pressable onPress={open} accessibilityRole="button" accessibilityLabel={`Working on ${task.content}. Open task`} style={styles.row}>
                <View style={styles.tile}>
                    <WorkspaceIcon size={22} color={onPrimary} weight="regular" />
                </View>
                <View style={styles.text}>
                    <ThemedText type="defaultSemiBold" numberOfLines={1} style={{ color: onPrimary }}>
                        {task.content}
                    </ThemedText>
                    <ThemedText type="caption" numberOfLines={1} style={{ color: onPrimary + "BF", marginTop: -2 }}>
                        {startMs ? `${formatElapsed(now - startMs)} · ${workspaceName}` : `In progress · ${workspaceName}`}
                    </ThemedText>
                </View>
                <TouchableOpacity onPress={stop} hitSlop={10} accessibilityLabel="Stop working on task">
                    <Stop size={24} color={onPrimary} weight="fill" />
                </TouchableOpacity>
                <TouchableOpacity onPress={finish} hitSlop={10} accessibilityLabel="Mark task complete">
                    <Check size={26} color={onPrimary} weight="bold" />
                </TouchableOpacity>
            </Pressable>
            {progress != null && (
                <View style={styles.track}>
                    <View style={{ width: `${progress * 100}%`, height: 2, backgroundColor: onPrimary }} />
                </View>
            )}
        </Reanimated.View>
    );
}

const styles = StyleSheet.create({
    bar: { position: "absolute", left: HORIZONTAL_PADDING, right: HORIZONTAL_PADDING, height: BAR_HEIGHT, borderRadius: 10, overflow: "hidden", zIndex: 5 },
    row: { flex: 1, flexDirection: "row", alignItems: "center", gap: 14, paddingLeft: 8, paddingRight: 16 },
    tile: { width: 40, height: 40, borderRadius: 6, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF33" },
    text: { flex: 1 },
    track: { position: "absolute", left: 10, right: 10, bottom: 3, height: 2, backgroundColor: "#FFFFFF40", borderRadius: 1 },
});
