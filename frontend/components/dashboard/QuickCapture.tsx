import React, { useEffect, useRef, useState } from "react";
import { View, TextInput, TouchableOpacity, Pressable, StyleSheet, ActivityIndicator, useColorScheme, Keyboard } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import Reanimated, {
    Easing,
    LinearTransition,
    SharedValue,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";
import { ArrowUp, CalendarBlank, Check, Plus } from "phosphor-react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useTaskSuggestions } from "@/hooks/useTaskSuggestions";
import { useApplyCreatedTasks } from "@/hooks/useApplyCreatedTasks";
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

// On focus the rest of the screen blurs and the field opens into a taller,
// wrapping input. The height change is one layout pass animated natively,
// not a per-frame re-layout of the dashboard.
const EXPANDED_MIN_HEIGHT = 112;
const EXPANDED_MAX_HEIGHT = 200;
const FIELD_TRANSITION = LinearTransition.duration(200).easing(Easing.out(Easing.cubic));
const FOCUS_TIMING = { duration: 200, easing: Easing.out(Easing.cubic) };
const FOCUS_SHADOW_OPACITY = 0.24;

type Receipt = { content: string; details: string };

/**
 * One-line capture above the rings: type a task, hit send, done. Everything
 * else is inferred — the schedule is parsed from the text as it's typed,
 * priority and difficulty come from the suggest endpoint, and the category is
 * left to the background categorizer. The receipt names what was inferred so a
 * wrong guess is visible immediately rather than discovered later.
 */
export default function QuickCapture({ focusProgress }: { focusProgress?: SharedValue<number> }) {
    const ThemedColor = useThemeColor();
    const colorScheme = useColorScheme();
    const [text, setText] = useState("");
    const [receipt, setReceipt] = useState<Receipt | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [focused, setFocused] = useState(false);
    const inputRef = useRef<TextInput>(null);

    const { schedule, recurrence, fuzzy } = useTaskSuggestions(text);
    const { applyCreatedTask } = useApplyCreatedTasks();
    const { showRingUpdate } = useRingUpdate();
    const queryClient = useQueryClient();
    const { capture } = useAnalytics();

    // The parent passes a shared value so it can blur its own content in step;
    // standalone use falls back to a local one.
    const localProgress = useSharedValue(0);
    const progress = focusProgress ?? localProgress;
    const fieldAnimatedStyle = useAnimatedStyle(() => ({
        shadowOpacity: FOCUS_SHADOW_OPACITY * progress.value,
    }));
    const onFocus = () => {
        setFocused(true);
        progress.value = withTiming(1, FOCUS_TIMING);
    };
    const onBlur = () => {
        setFocused(false);
        progress.value = withTiming(0, FOCUS_TIMING);
    };
    // Dismissing the keyboard by other means (swipe-down, Android back) leaves
    // the input focused; treat the keyboard going away as leaving the field.
    // Only arm once this focus's keyboard has shown, so a late hide event from
    // the previous dismissal can't knock the field straight back out.
    useEffect(() => {
        if (!focused) return;
        let shown = false;
        const showSub = Keyboard.addListener("keyboardDidShow", () => {
            shown = true;
        });
        const hideSub = Keyboard.addListener("keyboardDidHide", () => {
            if (shown) inputRef.current?.blur();
        });
        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, [focused]);
    // Unmounting while focused (e.g. the home tour starting) never fires onBlur.
    useEffect(() => () => {
        progress.value = 0;
    }, [progress]);

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
            // The task landed in the Inbox; insert it there (refetches only if the Inbox is new).
            applyCreatedTask(response as any);
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
                title: "Couldn't add task",
                message: "Something went wrong on our end. Give it another try.",
                status: "danger",
                duration: 3000,
            });
        } finally {
            setSubmitting(false);
        }
    };

    const canSubmit = text.trim().length > 0 && !submitting;
    // Show what the parser picked up while typing, so a wrong date is caught
    // before the task exists rather than after.
    const preview = text.trim() ? describeSchedule(schedule, recurrence) : "";
    const isDark = colorScheme === "dark";

    return (
        <View style={{ gap: 8 }}>
            <Reanimated.View
                layout={FIELD_TRANSITION}
                style={[
                    styles.field,
                    focused && styles.fieldExpanded,
                    {
                        // Light mode reads as an empty task row on the page
                        // rather than a gray well; dark keeps a raised surface.
                        backgroundColor: isDark ? ThemedColor.lightened : ThemedColor.background,
                        borderColor: ThemedColor.tertiary,
                    },
                    fieldAnimatedStyle,
                ]}>
                {/* The text itself is one line tall; make the whole field focus the input */}
                <Pressable
                    style={StyleSheet.absoluteFill}
                    onPress={() => inputRef.current?.focus()}
                    accessible={false}
                />
                <Plus size={18} color={ThemedColor.primary} weight="bold" style={focused && styles.plusExpanded} />
                {/* Always multiline: flipping it on focus swaps the native view and drops focus */}
                <TextInput
                    ref={inputRef}
                    multiline
                    submitBehavior="submit"
                    value={text}
                    onChangeText={setText}
                    onSubmitEditing={submit}
                    onFocus={onFocus}
                    onBlur={onBlur}
                    placeholder="Add a task"
                    placeholderTextColor={ThemedColor.caption}
                    returnKeyType="done"
                    style={[styles.input, focused && styles.inputExpanded, { color: ThemedColor.text }]}
                />
                {(canSubmit || submitting) && (
                    <TouchableOpacity
                        onPress={submit}
                        disabled={!canSubmit}
                        accessibilityLabel="Create task"
                        hitSlop={8}
                        style={[styles.send, focused && styles.sendExpanded, { backgroundColor: ThemedColor.primary }]}>
                        {submitting ? (
                            <ActivityIndicator size="small" color={ThemedColor.buttonText} />
                        ) : (
                            <ArrowUp size={16} color={ThemedColor.buttonText} weight="bold" />
                        )}
                    </TouchableOpacity>
                )}
            </Reanimated.View>

            {preview !== "" && (
                <Reanimated.View layout={FIELD_TRANSITION} style={[styles.chip, { backgroundColor: ThemedColor.primary + "14" }]}>
                    <CalendarBlank size={14} color={ThemedColor.primary} weight="bold" />
                    <ThemedText type="caption" style={{ color: ThemedColor.primary }}>
                        {preview}
                    </ThemedText>
                </Reanimated.View>
            )}

            {receipt && (
                <Reanimated.View layout={FIELD_TRANSITION} style={styles.receipt} accessibilityLiveRegion="polite">
                    <Check size={14} color={ThemedColor.primary} weight="bold" />
                    <ThemedText type="caption" numberOfLines={1} style={{ flex: 1 }}>
                        Added “{receipt.content}” — {receipt.details}
                    </ThemedText>
                </Reanimated.View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    field: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        minHeight: 48,
        borderRadius: 12,
        borderWidth: 1,
        paddingLeft: 16,
        paddingRight: 8,
        paddingVertical: 8,
        // Shadow fades in on focus (opacity is animated)
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowRadius: 16,
        shadowOpacity: 0,
    },
    fieldExpanded: {
        alignItems: "flex-start",
        minHeight: EXPANDED_MIN_HEIGHT,
        paddingTop: 12,
        paddingBottom: 8,
    },
    plusExpanded: {
        marginTop: 2,
    },
    input: {
        flex: 1,
        fontSize: 16,
        fontFamily: "OutfitLight",
        padding: 0,
    },
    inputExpanded: {
        alignSelf: "stretch",
        maxHeight: EXPANDED_MAX_HEIGHT,
        textAlignVertical: "top",
    },
    send: {
        width: 32,
        height: 32,
        borderRadius: 100,
        alignItems: "center",
        justifyContent: "center",
    },
    sendExpanded: {
        alignSelf: "flex-end",
    },
    chip: {
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
        gap: 4,
        borderRadius: 100,
        paddingHorizontal: 12,
        paddingVertical: 4,
    },
    receipt: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 16,
    },
});
