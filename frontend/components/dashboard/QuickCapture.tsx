import React, { useEffect, useState } from "react";
import { View, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check, MagicWand } from "phosphor-react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useTaskSuggestions } from "@/hooks/useTaskSuggestions";
import { useTasks } from "@/contexts/tasksContext";
import { useRingUpdate } from "@/contexts/ringUpdateContext";
import { createTaskAutoAPI } from "@/api/task";
import { buildQuickCaptureTask, describeEnrichment } from "@shared/quickCapture";
import { describeSchedule } from "@shared/taskSuggest";
import { logger } from "@/utils/logger";
import { useAnalytics } from "@/hooks/useAnalytics";
import { AnalyticsEvents } from "@/utils/analytics";

// How long the confirmation sticks around. Long enough to read and catch a
// wrong date, short enough that it doesn't become furniture.
const RECEIPT_MS = 8000;

type Receipt = { content: string; details: string };

/**
 * One-line capture above the rings: type a task, hit send, done. Everything
 * else is inferred — the schedule is parsed from the text as it's typed,
 * priority and difficulty come from the suggest endpoint, and the category is
 * left to the background categorizer. The receipt names what was inferred so a
 * wrong guess is visible immediately rather than discovered later.
 */
export default function QuickCapture() {
    const ThemedColor = useThemeColor();
    const [text, setText] = useState("");
    const [receipt, setReceipt] = useState<Receipt | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const { schedule, recurrence, fuzzy } = useTaskSuggestions(text);
    const { fetchWorkspaces } = useTasks();
    const { showRingUpdate } = useRingUpdate();
    const queryClient = useQueryClient();
    const { capture } = useAnalytics();

    useEffect(() => {
        if (!receipt) return;
        const timer = setTimeout(() => setReceipt(null), RECEIPT_MS);
        return () => clearTimeout(timer);
    }, [receipt]);

    const submit = async () => {
        const content = text.trim();
        if (!content || submitting) return;

        const body = buildQuickCaptureTask(content, schedule, recurrence, fuzzy);
        const details = describeEnrichment(describeSchedule(schedule, recurrence), fuzzy?.priority);

        // Clear straight away so the field is ready for the next thought; the
        // text comes back if the create fails.
        setText("");
        setSubmitting(true);
        try {
            const response = await createTaskAutoAPI(body as any);
            // The task landed in the Inbox, so pull the tree to show it.
            await fetchWorkspaces(true);
            showRingUpdate((response as any)?.ringDelta);
            queryClient.invalidateQueries({ queryKey: ["rings", "today"] });
            capture(AnalyticsEvents.TASK_CREATED, {
                source: "quick_capture",
                auto_categorize: true,
                has_deadline: !!body.deadline,
                has_checklist: false,
            });
            setReceipt({ content, details });
        } catch (error) {
            logger.error("Quick capture failed", error);
            setText(content);
            const { showToastable } = await import("react-native-toastable");
            showToastable({
                message: "Failed to create task. Please try again.",
                status: "danger",
                duration: 3000,
            });
        } finally {
            setSubmitting(false);
        }
    };

    const canSubmit = text.trim().length > 0 && !submitting;

    return (
        <View style={{ gap: 8 }}>
            <View style={[styles.field, { backgroundColor: ThemedColor.lightened }]}>
                <MagicWand size={18} color={ThemedColor.caption} weight="regular" />
                <TextInput
                    value={text}
                    onChangeText={setText}
                    onSubmitEditing={submit}
                    placeholder="Add a task — we'll sort out the details"
                    placeholderTextColor={ThemedColor.caption}
                    returnKeyType="done"
                    style={[styles.input, { color: ThemedColor.text }]}
                />
                <TouchableOpacity
                    onPress={submit}
                    disabled={!canSubmit}
                    accessibilityLabel="Create task"
                    hitSlop={8}
                    style={[
                        styles.send,
                        { backgroundColor: ThemedColor.primary + "1A", opacity: canSubmit ? 1 : 0.4 },
                    ]}>
                    {submitting ? (
                        <ActivityIndicator size="small" color={ThemedColor.primary} />
                    ) : (
                        <ArrowRight size={16} color={ThemedColor.primary} weight="bold" />
                    )}
                </TouchableOpacity>
            </View>

            {receipt && (
                <View style={styles.receipt} accessibilityLiveRegion="polite">
                    <Check size={14} color={ThemedColor.primary} weight="bold" />
                    <ThemedText type="caption" numberOfLines={1} style={{ flex: 1 }}>
                        Added “{receipt.content}” — {receipt.details}
                    </ThemedText>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    field: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    input: {
        flex: 1,
        fontSize: 16,
        fontFamily: "OutfitLight",
        padding: 0,
    },
    send: {
        width: 32,
        height: 32,
        borderRadius: 100,
        alignItems: "center",
        justifyContent: "center",
    },
    receipt: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 16,
    },
});
