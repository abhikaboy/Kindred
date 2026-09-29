import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { Check } from "phosphor-react-native";
import { showToastable, hideToastable } from "react-native-toastable";
import DefaultModal from "@/components/modals/DefaultModal";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useTasks } from "@/contexts/tasksContext";
import { useAnalytics } from "@/hooks/useAnalytics";
import { AnalyticsEvents } from "@/utils/analytics";
import { showToast } from "@/utils/showToast";
import { releaseTasksBulkAPI, unreleaseTaskAPI } from "@/api/plan";
import { fogCandidates, pickWaitingCandidate } from "@/utils/waitingCandidate";
import { openPlanSheet } from "@/hooks/planSheetStore";
import { fogReleaseItems } from "@/hooks/useReleasedTasks";
import type { Task } from "@/api/types";

type Props = { visible: boolean; onClose: () => void };

/** Bulk release of long-waiting tasks. Bulk is for release only; planning stays one task at a time. */
export function ClearFogSheet({ visible, onClose }: Props) {
    const ThemedColor = useThemeColor();
    const { allTasks, removeFromCategory, addToCategory } = useTasks();
    const { capture } = useAnalytics();

    // Freeze the list when the sheet opens so rows don't shift as tasks are released.
    const [candidates, setCandidates] = useState<Task[]>([]);
    const [keep, setKeep] = useState<Set<string>>(new Set());
    const [done, setDone] = useState(false);

    useEffect(() => {
        if (!visible) return;
        setCandidates(fogCandidates(allTasks) as Task[]);
        setKeep(new Set());
        setDone(false);
        // Only on open
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible]);

    const toggle = useCallback((id: string) => {
        setKeep((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const count = candidates.length - keep.size;
    const next = useMemo(() => (done ? (pickWaitingCandidate(allTasks) as Task | null) : null), [done, allTasks]);

    const release = useCallback(() => {
        const items = fogReleaseItems(candidates, keep);
        if (items.length === 0) return;
        const released = candidates.filter((t) => items.some((i) => i.taskId === t.id));

        released.forEach((t) => removeFromCategory(t.categoryID as string, t.id));
        setDone(true);
        capture(AnalyticsEvents.FOG_CLEARED, { count: items.length });

        const restore = (tasks: Task[]) => tasks.forEach((t) => addToCategory(t.categoryID as string, { ...t, releasedAt: null }));

        const undo = () => {
            hideToastable();
            restore(released);
            released.forEach((t) => unreleaseTaskAPI(t.categoryID as string, t.id).catch(() => {}));
        };

        showToastable({
            message: "Let go. You can bring them back anytime.",
            status: "success",
            duration: 4000,
            swipeDirection: "up",
            renderContent: () => <UndoLine message="Let go. You can bring them back anytime." onUndo={undo} />,
        });

        releaseTasksBulkAPI(items)
            .then(({ failedTaskIds }) => {
                if (failedTaskIds.length === 0) return;
                restore(released.filter((t) => failedTaskIds.includes(t.id)));
            })
            .catch(() => {
                restore(released);
                showToast("Couldn't let those go right now. They're still here.", "warning");
            });
    }, [candidates, keep, removeFromCategory, addToCategory, capture]);

    const plan = useCallback(() => {
        if (!next) return;
        onClose();
        openPlanSheet({ task: next });
    }, [next, onClose]);

    const setVisible = useCallback((v: boolean) => !v && onClose(), [onClose]);

    return (
        <DefaultModal visible={visible} setVisible={setVisible} snapPoints={["75%"]}>
            {!done ? (
                <Animated.View key="pick" entering={FadeIn.duration(200)} exiting={FadeOut.duration(120)} style={styles.fill}>
                    <ThemedText type="subtitle">Clear the fog</ThemedText>
                    <ThemedText type="caption" style={styles.caption}>
                        Let these go for now. You can bring any back.
                    </ThemedText>
                    <ScrollView style={styles.fill} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
                        {candidates.map((t) => {
                            const on = !keep.has(t.id);
                            return (
                                <TouchableOpacity
                                    key={t.id}
                                    onPress={() => toggle(t.id)}
                                    activeOpacity={0.6}
                                    accessibilityRole="checkbox"
                                    accessibilityState={{ checked: on }}
                                    style={styles.row}>
                                    <View
                                        style={[
                                            styles.check,
                                            { backgroundColor: on ? ThemedColor.primary : ThemedColor.tertiary },
                                        ]}>
                                        {on && <Check size={14} weight="bold" color={ThemedColor.buttonText} />}
                                    </View>
                                    <ThemedText type="default" numberOfLines={2} style={styles.fill}>
                                        {t.content}
                                    </ThemedText>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                    <PrimaryButton title={`Release these (${count})`} onPress={release} disabled={count === 0} />
                </Animated.View>
            ) : (
                <Animated.View key="after" entering={FadeIn.duration(240)} style={styles.after}>
                    <ThemedText type="subtitle">Clearer now.</ThemedText>
                    {next ? (
                        <>
                            <ThemedText type="caption" style={styles.caption}>
                                Want a tiny path for {next.content}?
                            </ThemedText>
                            <PrimaryButton title="Build a plan" onPress={plan} style={{ marginTop: 16 }} />
                        </>
                    ) : null}
                    <TouchableOpacity onPress={onClose} hitSlop={8} style={styles.quiet}>
                        <ThemedText type="caption">Done for now</ThemedText>
                    </TouchableOpacity>
                </Animated.View>
            )}
        </DefaultModal>
    );
}

function UndoLine({ message, onUndo }: { message: string; onUndo: () => void }) {
    const ThemedColor = useThemeColor();
    return (
        <View style={styles.toastWrap}>
            <View style={[styles.toast, { backgroundColor: ThemedColor.lightened }]}>
                <ThemedText type="default" style={styles.fill}>
                    {message}
                </ThemedText>
                <TouchableOpacity onPress={onUndo} hitSlop={8}>
                    <ThemedText type="defaultSemiBold" style={{ color: ThemedColor.primary }}>
                        Undo
                    </ThemedText>
                </TouchableOpacity>
            </View>
        </View>
    );
}

/** Quiet text link that opens Clear the fog. Renders nothing unless the waiting pile is foggy. */
export function ClearFogAction() {
    const ThemedColor = useThemeColor();
    const { allTasks } = useTasks();
    const [open, setOpen] = useState(false);
    const hasFog = useMemo(() => fogCandidates(allTasks).length > 0, [allTasks]);
    const close = useCallback(() => setOpen(false), []);

    return (
        <>
            {hasFog && (
                <TouchableOpacity onPress={() => setOpen(true)} hitSlop={8} accessibilityRole="button">
                    <ThemedText type="default" style={{ color: ThemedColor.primary }}>
                        Clear the fog
                    </ThemedText>
                </TouchableOpacity>
            )}
            <ClearFogSheet visible={open} onClose={close} />
        </>
    );
}

export default ClearFogSheet;

const styles = StyleSheet.create({
    fill: { flex: 1 },
    caption: { marginTop: 4 },
    list: { paddingVertical: 16 },
    row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
    check: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    after: { paddingTop: 8 },
    quiet: { marginTop: 16, alignSelf: "center", paddingVertical: 8 },
    toastWrap: { alignItems: "center", paddingHorizontal: 20 },
    toast: {
        width: "100%",
        flexDirection: "row",
        alignItems: "center",
        gap: 16,
        borderRadius: 12,
        paddingVertical: 16,
        paddingHorizontal: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
        elevation: 6,
    },
});
