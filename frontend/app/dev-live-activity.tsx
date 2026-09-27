import React, { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Redirect, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import { useTasks } from "@/contexts/tasksContext";
import { endActivity, tryStartActiveTaskActivity, tryStartDeadlineActivity } from "@/utils/liveActivityManager";
import { ActiveTaskActivityFactory, DeadlineCountdownActivityFactory } from "@/widgets/widgetUpdaters";

// Dev-only launcher for Live Activities: kindred:///dev-live-activity?type=soon
type Kind = "active" | "upcoming" | "soon" | "overdue";

const DEADLINE_OFFSETS_MIN: Record<Exclude<Kind, "active">, number> = { upcoming: 45, soon: 5, overdue: -3 };

export const DEV_SAMPLE_TASK_ID = "dev-sample";

export default function DevLiveActivityScreen() {
    const { type } = useLocalSearchParams<{ type?: string }>();
    const { allTasks } = useTasks();
    const insets = useSafeAreaInsets();
    const [result, setResult] = useState("");

    // A real task makes Done and Dismiss testable end to end
    const realTask = allTasks.find((t) => !(t as any).timeCompleted);

    const fire = async (kind: Kind) => {
        await endActivity(DEV_SAMPLE_TASK_ID);
        if (realTask) await endActivity(realTask.id);

        if (kind === "active") {
            const task = realTask;
            const started = await tryStartActiveTaskActivity(
                task?.id ?? DEV_SAMPLE_TASK_ID,
                {
                    taskName: task?.content ?? "Deep work: roadmap",
                    workspaceName: task?.workspaceName || "Work",
                    startTime: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
                    endTime: new Date(Date.now() + 42 * 60 * 1000).toISOString(),
                    hasEndTime: true,
                    categoryId: task?.categoryID ?? "",
                    taskId: task?.id ?? DEV_SAMPLE_TASK_ID,
                },
                { userInitiated: true }
            );
            setResult(started ? `Started in-progress activity for "${task?.content ?? "sample"}"` : "Could not start (Live Activities disabled?)");
            return;
        }

        // Deadline samples use a fake id so the scheduler doesn't end them for a deadline mismatch
        const started = await tryStartDeadlineActivity(
            DEV_SAMPLE_TASK_ID,
            {
                taskName: "Write sprint notes",
                workspaceName: "Personal",
                deadline: new Date(Date.now() + DEADLINE_OFFSETS_MIN[kind] * 60 * 1000).toISOString(),
                priority: 2,
                categoryId: "",
                taskId: DEV_SAMPLE_TASK_ID,
            },
            { userInitiated: true }
        );
        setResult(started ? `Started ${kind} deadline activity` : "Could not start (Live Activities disabled?)");
    };

    const endAll = async () => {
        await endActivity(DEV_SAMPLE_TASK_ID, "immediate");
        if (realTask) await endActivity(realTask.id, "immediate");
        ActiveTaskActivityFactory.getInstances().forEach((a) => a.end("immediate").catch(() => {}));
        DeadlineCountdownActivityFactory.getInstances().forEach((a) => a.end("immediate").catch(() => {}));
        setResult("Ended");
    };

    // Fire once per link; the effect can re-run on remount
    const firedRef = useRef<string | null>(null);
    useEffect(() => {
        if (firedRef.current === type) return;
        firedRef.current = type ?? null;
        if (type === "active" || type === "upcoming" || type === "soon" || type === "overdue") fire(type);
        if (type === "end") endAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [type]);

    if (!__DEV__) return <Redirect href="/" />;

    return (
        <ThemedView style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + 24 }]}>
                <ThemedText type="subtitle">Live Activity lab</ThemedText>
                <ThemedText type="caption">
                    Starts an activity, then lock the device or background the app to see it.
                </ThemedText>
                <View style={styles.buttons}>
                    <PrimaryButton title="In progress (real task)" onPress={() => fire("active")} />
                    <PrimaryButton title="Deadline: upcoming" onPress={() => fire("upcoming")} />
                    <PrimaryButton title="Deadline: due soon" onPress={() => fire("soon")} />
                    <PrimaryButton title="Deadline: overdue" onPress={() => fire("overdue")} />
                    <PrimaryButton title="End all" outline onPress={endAll} />
                </View>
                {!!result && <ThemedText type="default">{result}</ThemedText>}
            </ScrollView>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: { paddingHorizontal: HORIZONTAL_PADDING, gap: 12 },
    buttons: { gap: 12, marginTop: 12 },
});
