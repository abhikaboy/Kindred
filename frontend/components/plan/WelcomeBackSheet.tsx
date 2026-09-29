import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { InteractionManager, StyleSheet, TouchableOpacity, View } from "react-native";
import { CaretRight, PathIcon as Path, Sun, Wind, type Icon } from "phosphor-react-native";
import DefaultModal from "@/components/modals/DefaultModal";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useTasks } from "@/contexts/tasksContext";
import { openPlanSheet, usePlanSheet } from "@/hooks/planSheetStore";
import { useReturnGap } from "@/hooks/useReturnGap";
import { useWaitingCandidate } from "@/hooks/useWaitingCandidate";
import { useAnalytics } from "@/hooks/useAnalytics";
import { AnalyticsEvents } from "@/utils/analytics";
import { fogCandidates } from "@/utils/waitingCandidate";
import ClearFogSheet from "@/components/plan/ClearFogSheet";
import type { Task } from "@/api/types";
import { markReturnedAPI } from "@/api/plan";

type Choice = "move_one" | "clear_fog" | "start_fresh" | "dismiss";
type Props = { waiting: Task[] };

// Let the sheet close before the next one presents, so sheets never stack
const HANDOFF_MS = 350;
// Wait for Today to settle before greeting
const SETTLE_MS = 800;

const Row = ({ Icon, title, line, onPress }: { Icon: Icon; title: string; line: string; onPress: () => void }) => {
    const ThemedColor = useThemeColor();
    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.7}
            accessibilityRole="button"
            style={[styles.row, { backgroundColor: ThemedColor.lightenedCard, boxShadow: ThemedColor.shadowSmall }]}
        >
            <Icon size={24} color={ThemedColor.primary} weight="regular" />
            <View style={styles.rowText}>
                <ThemedText type="default">{title}</ThemedText>
                <ThemedText type="caption" numberOfLines={1} style={{ color: ThemedColor.caption }}>
                    {line}
                </ThemedText>
            </View>
            <CaretRight size={16} color={ThemedColor.caption} />
        </TouchableOpacity>
    );
};

/** A soft landing after days away: one gentle offer, never a recap of the gap. */
const WelcomeBackSheet = ({ waiting }: Props) => {
    const ThemedColor = useThemeColor();
    const { allTasks } = useTasks();
    const { gap, markHandled } = useReturnGap();
    const { candidate } = useWaitingCandidate(waiting);
    const planSheet = usePlanSheet();
    const { capture } = useAnalytics();
    const [settled, setSettled] = useState(false);
    const [fogOpen, setFogOpen] = useState(false);
    const choiceRef = useRef<Choice | null>(null);
    const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

    useEffect(() => {
        let t: ReturnType<typeof setTimeout>;
        const handle = InteractionManager.runAfterInteractions(() => {
            t = setTimeout(() => setSettled(true), SETTLE_MS);
        });
        return () => {
            handle.cancel();
            clearTimeout(t);
            timers.current.forEach(clearTimeout);
        };
    }, []);

    const showFog = useMemo(() => fogCandidates(allTasks as any[]).length > 0, [allTasks]);
    const visible = !!gap && !!candidate && settled && !planSheet && !fogOpen;
    const reportedRef = useRef(false);

    useEffect(() => {
        if (!visible || reportedRef.current || !gap) return;
        reportedRef.current = true;
        markReturnedAPI(gap.days).catch(() => {});
    }, [visible, gap]);

    const finish = useCallback(
        (choice: Choice, then?: () => void) => {
            if (choiceRef.current) return;
            choiceRef.current = choice;
            capture(AnalyticsEvents.RETURN_AFTER_GAP, { gapDays: gap?.days, choice });
            markHandled();
            if (then) timers.current.push(setTimeout(then, HANDOFF_MS));
        },
        [capture, gap?.days, markHandled]
    );

    const setVisible = useCallback((v: boolean) => !v && finish("dismiss"), [finish]);

    return (
        <>
            <DefaultModal visible={visible} setVisible={setVisible} enableDynamicSizing>
                <ThemedText type="titleFraunces">Welcome back</ThemedText>
                <ThemedText type="lightBody" style={{ color: ThemedColor.caption, marginTop: 4 }}>
                    Let's make today feel light.
                </ThemedText>
                <View style={styles.list}>
                    {candidate && (
                        <Row
                            Icon={Path}
                            title="Move one thing forward"
                            line={candidate.content}
                            onPress={() => finish("move_one", () => openPlanSheet({ task: candidate }))}
                        />
                    )}
                    {showFog && (
                        <Row
                            Icon={Wind}
                            title="Clear the fog"
                            line="Let go of what no longer matters"
                            onPress={() => finish("clear_fog", () => setFogOpen(true))}
                        />
                    )}
                    <Row
                        Icon={Sun}
                        title="Start fresh today"
                        line="Just focus on today"
                        onPress={() => finish("start_fresh")}
                    />
                </View>
            </DefaultModal>
            <ClearFogSheet visible={fogOpen} onClose={() => setFogOpen(false)} />
        </>
    );
};

const styles = StyleSheet.create({
    list: {
        gap: 12,
        marginTop: 24,
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        gap: 16,
        padding: 20,
        borderRadius: 16,
    },
    rowText: {
        flex: 1,
        gap: 4,
    },
});

export default WelcomeBackSheet;
