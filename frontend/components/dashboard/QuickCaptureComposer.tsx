import React, { useEffect, useRef, useState } from "react";
import {
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Reanimated, {
    Easing,
    FadeIn,
    FadeOut,
    LinearTransition,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";
import { ArrowUp, CalendarBlank, Flag, Microphone, Plus, Sparkle, Stop, X } from "phosphor-react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useTaskSuggestions } from "@/hooks/useTaskSuggestions";
import { useApplyCreatedTasks } from "@/hooks/useApplyCreatedTasks";
import { useRingUpdate } from "@/contexts/ringUpdateContext";
import {
    createTaskAPI,
    createTaskAutoAPI,
    getTaskPredictionsAPI,
    suggestTaskFieldsAPI,
    type TaskFieldSuggestion,
} from "@/api/task";
import { buildQuickCaptureTask, describeEnrichment } from "@shared/quickCapture";
import { describeSchedule, parseRecurrence, parseSchedule } from "@shared/taskSuggest";
import { VoiceWaveform } from "@/components/ui/VoiceWaveform";
import TaskChip from "@/components/cards/TaskChip";
import { useTasksSelector } from "@/contexts/tasksContext";
import { getCategoryDuotoneColors } from "@/utils/categoryColors";
import { CAPTURE_STARTERS } from "@/utils/captureSuggestions";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { SectionTitle } from "@/components/dashboard/SectionHeader";
import { useVoiceCapture } from "@/hooks/useVoiceCapture";
import { CaptureBackdrop, Glass, GLASS, ON_DARK, ON_DARK_MUTED } from "@/components/capture/CaptureStage";
import { logger } from "@/utils/logger";
import { useAnalytics } from "@/hooks/useAnalytics";
import { AnalyticsEvents } from "@/utils/analytics";

export type Receipt = { content: string; details: string };

// A task typed and staged with Enter but not created yet. Priority fills in
// once its own suggest call returns, so it never borrows the previous line's.
type Draft = { id: number; content: string; fuzzy: TaskFieldSuggestion | null };

const draftSchedule = (d: Draft) => {
    const now = new Date();
    return describeSchedule(parseSchedule(d.content, now), parseRecurrence(d.content, now));
};

const draftDetails = (d: Draft) => {
    const now = new Date();
    return describeEnrichment(
        describeSchedule(parseSchedule(d.content, now), parseRecurrence(d.content, now)),
        d.fuzzy?.priority
    );
};

const TASK_PREDICTIONS_KEY = ["taskPredictions"] as const;
const FADE = { duration: 220, easing: Easing.out(Easing.cubic) };
const PILE_TRANSITION = LinearTransition.duration(200).easing(Easing.out(Easing.cubic));
const PRIORITY_LABEL: Record<number, string> = { 1: "Low priority", 2: "Medium priority", 3: "High priority" };
// Shown while the field is empty. Tapping one fills the field to edit, it
// doesn't stage it, and each shows off a different thing the parser picks up.
// Kept short: they stack vertically above the field.
// Appended to the text; the schedule parser does the rest.
const QUICK_WHEN = ["today", "tonight", "tomorrow", "this weekend", "next week", "every day"];

interface Props {
    visible: boolean;
    /** Open listening instead of on the keyboard. */
    startWithVoice?: boolean;
    onClose: (lastReceipt: Receipt | null) => void;
}

/**
 * Full-screen capture stage: the voice overlay's dimmed backdrop, the input
 * docked on the keyboard, and everything else (live parse, quick dates,
 * staged drafts) piled above it. Enter stages a line as a draft; one confirm
 * creates them all. The mic swaps the keyboard for a waveform and streams the
 * transcript into the same field, so spoken lines are staged the same way.
 *
 * The backdrop blur is a fixed intensity faded by opacity. Animating
 * BlurView's intensity renders inconsistently (and shows up in screenshots).
 */
export default function QuickCaptureComposer({ visible, startWithVoice = false, onClose }: Props) {
    const ThemedColor = useThemeColor();
    const insets = useSafeAreaInsets();
    const [mounted, setMounted] = useState(visible);
    const [text, setText] = useState("");
    const [drafts, setDrafts] = useState<Draft[]>([]);
    // The keyboard listener holds an early close(); read drafts through a ref so it isn't stale.
    const draftsRef = useRef<Draft[]>([]);
    draftsRef.current = drafts;
    const nextId = useRef(0);
    const receiptRef = useRef<Receipt | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [keyboardUp, setKeyboardUp] = useState(false);
    const inputRef = useRef<TextInput>(null);
    const closingRef = useRef(false);
    const opacity = useSharedValue(0);
    // voiceModeRef is set while voice owns the screen, so the keyboard dropping for the mic doesn't close us.
    const { listening, volume, toggleMic, cancelListening, voiceModeRef } = useVoiceCapture({
        text,
        setText,
        disabled: submitting,
        isClosing: () => closingRef.current,
        refocus: () => inputRef.current?.focus(),
    });

    const { schedule, recurrence, fuzzy } = useTaskSuggestions(text);
    // Resolves each draft's suggested category to the name and color it'll land in
    const workspaces = useTasksSelector((st) => st.workspaces);
    const categoryById = React.useMemo(() => {
        const map = new Map<string, { name: string; workspace: string }>();
        for (const ws of workspaces ?? []) {
            for (const c of ws.categories ?? []) map.set(c.id, { name: c.name, workspace: ws.name });
        }
        return map;
    }, [workspaces]);

    // Predicted from the user's rhythms, deadlines and recent completions; the
    // server caches per user, so reopening the composer is cheap
    const { data: predictions, isPending: predictionsPending } = useQuery({
        queryKey: TASK_PREDICTIONS_KEY,
        queryFn: getTaskPredictionsAPI,
        staleTime: 10 * 60 * 1000,
    });
    // Staged ones leave the list; the rest stay tappable
    const personal = (predictions ?? []).filter((p) => !drafts.some((d) => d.content === p.content));
    // Nothing predicted: fall back to the examples, which show off the parser
    const isPersonal = personal.length > 0;
    const { applyCreatedTask } = useApplyCreatedTasks();
    const { showRingUpdate } = useRingUpdate();
    const queryClient = useQueryClient();
    const { capture } = useAnalytics();

    useEffect(() => {
        if (visible) {
            closingRef.current = false;
            setMounted(true);
            opacity.value = withTiming(1, FADE);
        }
        // toggleMic is recreated each render; only opening should trigger it
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible, opacity]);

    const finishClose = () => {
        // Reopened mid-fade: the interrupted fade-out must not unmount the new session
        if (!closingRef.current) return;
        setMounted(false);
        setText("");
        setDrafts([]);
        onClose(receiptRef.current);
        receiptRef.current = null;
    };

    const close = () => {
        if (closingRef.current) return;
        closingRef.current = true;
        voiceModeRef.current = false;
        cancelListening();
        Keyboard.dismiss();
        // Unmount even if the fade is interrupted: a mounted modal at opacity 0
        // is invisible but still swallows every touch on the screen.
        opacity.value = withTiming(0, FADE, () => {
            runOnJS(finishClose)();
        });
    };

    // Swiping the keyboard away means "done" unless the mic is what hid it.
    useEffect(() => {
        if (!mounted) return;
        // Only arm close-on-hide once this session's keyboard has fully shown, so
        // the hide iOS fires while presenting the modal can't knock us straight back out.
        let shown = false;
        const willShow = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", () => {
            setKeyboardUp(true);
            voiceModeRef.current = false;
        });
        const didShow = Keyboard.addListener("keyboardDidShow", () => {
            shown = true;
        });
        const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => {
            setKeyboardUp(false);
            // With drafts staged, lowering the keyboard just reveals them; it isn't "done".
            if (shown && !voiceModeRef.current && draftsRef.current.length === 0) close();
        });
        return () => {
            willShow.remove();
            didShow.remove();
            hide.remove();
        };
        // close reads refs only; re-subscribing per render would drop events
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mounted]);

    // ─── Submit ───────────────────────────────────────────────────────────────

    // Enter stages the line; nothing is created until confirm.
    // A known category (from a prediction) is kept over the suggest call's guess
    const stageDraft = (content: string, categoryId?: string) => {
        const id = nextId.current++;
        setDrafts((prev) => [...prev, { id, content, fuzzy: categoryId ? { categoryId } : null }]);
        suggestTaskFieldsAPI(content)
            .then((fuzzy) =>
                setDrafts((prev) =>
                    prev.map((d) =>
                        d.id === id ? { ...d, fuzzy: { ...fuzzy, ...(categoryId ? { categoryId } : {}) } } : d
                    )
                )
            )
            .catch(() => {});
    };

    const addDraft = () => {
        const content = text.trim();
        if (!content || submitting) return;
        cancelListening();
        setText("");
        stageDraft(content);
    };

    const removeDraft = (id: number) => setDrafts((prev) => prev.filter((d) => d.id !== id));

    const confirm = async () => {
        if (submitting) return;
        cancelListening();
        // Whatever's still in the field counts too
        const pending = text.trim();
        const all: Draft[] = pending
            ? [...drafts, { id: nextId.current++, content: pending, fuzzy: fuzzy ?? null }]
            : drafts;
        if (all.length === 0) return;
        setText("");
        setDrafts(all);
        setSubmitting(true);

        const now = new Date();
        const results = await Promise.allSettled(
            all.map(async (d) => {
                const body = buildQuickCaptureTask(
                    d.content,
                    parseSchedule(d.content, now),
                    parseRecurrence(d.content, now),
                    d.fuzzy
                );
                // File it where the card said it would go; unknown or no guess falls back to auto-sort
                const categoryId = d.fuzzy?.categoryId;
                const response =
                    categoryId && categoryById.has(categoryId)
                        ? await createTaskAPI(categoryId, body as any)
                        : await createTaskAutoAPI(body as any);
                applyCreatedTask(response as any);
                showRingUpdate((response as any)?.ringDelta);
                capture(AnalyticsEvents.TASK_CREATED, {
                    source: "quick_capture",
                    auto_categorize: !(categoryId && categoryById.has(categoryId)),
                    has_deadline: !!body.deadline,
                    has_checklist: false,
                });
            })
        );
        queryClient.invalidateQueries({ queryKey: ["rings", "today"] });
        queryClient.invalidateQueries({ queryKey: TASK_PREDICTIONS_KEY });
        setSubmitting(false);

        const created = all.filter((_, i) => results[i].status === "fulfilled");
        const failed = all.filter((_, i) => results[i].status === "rejected");
        if (created.length > 0) {
            receiptRef.current =
                created.length === 1
                    ? { content: created[0].content, details: draftDetails(created[0]) }
                    : { content: `${created.length} tasks`, details: "sorting into categories" };
        }
        if (failed.length === 0) {
            close();
            return;
        }
        // Keep only what didn't make it so a retry can't double-create
        logger.error(
            "Quick capture failed",
            results.filter((r) => r.status === "rejected")
        );
        setDrafts(failed);
        const { showToastable } = await import("react-native-toastable");
        showToastable({
            title: failed.length === 1 ? "Couldn't add a task" : `Couldn't add ${failed.length} tasks`,
            message: "They're still here. Give it another try.",
            status: "danger",
            duration: 3000,
        });
    };

    const applyStarter = (starter: string) => {
        setText(starter);
        inputRef.current?.focus();
    };

    const appendWhen = (phrase: string) => {
        setText((prev) => (prev.trim() ? `${prev.trimEnd()} ${phrase}` : prev));
        inputRef.current?.focus();
    };

    const stackStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ translateY: (1 - opacity.value) * 16 }],
    }));

    if (!mounted) return null;

    const hasText = text.trim().length > 0;
    const canAdd = hasText && !submitting;
    const priorityColor = (p: number) =>
        p >= 3 ? ThemedColor.error : p === 2 ? ThemedColor.warning : ThemedColor.success;
    const confirmCount = drafts.length + (hasText ? 1 : 0);
    const preview = hasText ? describeSchedule(schedule, recurrence) : "";
    const priorityLabel = hasText && fuzzy?.priority ? PRIORITY_LABEL[fuzzy.priority] : "";
    const bottomGap = keyboardUp ? 12 : insets.bottom + 16;

    return (
        <Modal
            visible
            transparent
            animationType="none"
            statusBarTranslucent
            onRequestClose={close}
            // Focus once presented; autoFocus fires before the modal is on screen
            onShow={() => (startWithVoice ? toggleMic() : inputRef.current?.focus())}>
            <CaptureBackdrop opacity={opacity} />

            <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close task input" />

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={styles.fill}
                pointerEvents="box-none">
                <Reanimated.View
                    style={[styles.stack, { paddingBottom: bottomGap }, stackStyle]}
                    pointerEvents="box-none">
                    {drafts.map((d) => (
                        <Reanimated.View
                            key={d.id}
                            entering={FadeIn.duration(200)}
                            exiting={FadeOut.duration(150)}
                            layout={PILE_TRANSITION}>
                            <Glass style={styles.draft}>
                                {(() => {
                                    const category = d.fuzzy?.categoryId
                                        ? categoryById.get(d.fuzzy.categoryId)
                                        : undefined;
                                    const schedule = draftSchedule(d);
                                    return (
                                        <>
                                            {/* Straight, inset category bar like the planner's task rows;
                                                primary until the auto-sort guess comes back */}
                                            <View
                                                style={[
                                                    styles.categoryBar,
                                                    {
                                                        backgroundColor: category
                                                            ? getCategoryDuotoneColors(
                                                                  d.fuzzy?.categoryId,
                                                                  category.name,
                                                                  "dark"
                                                              ).dark
                                                            : ThemedColor.primary + "80",
                                                    },
                                                ]}
                                            />
                                            {/* TaskCard anatomy: title, quiet meta line, priority dot on the right */}
                                            <View style={styles.draftText}>
                                                <ThemedText type="default" numberOfLines={2} style={styles.draftTitle}>
                                                    {d.content}
                                                </ThemedText>
                                                <View style={styles.metaRow}>
                                                    {schedule !== "" && (
                                                        <TaskChip
                                                            inline
                                                            Icon={CalendarBlank}
                                                            label={schedule}
                                                            color={ON_DARK_MUTED}
                                                        />
                                                    )}
                                                    {category ? (
                                                        <TaskChip
                                                            inline
                                                            label={`${category.name} · ${category.workspace}`}
                                                            color={ON_DARK_MUTED}
                                                        />
                                                    ) : (
                                                        <TaskChip
                                                            inline
                                                            Icon={Sparkle}
                                                            label="Auto Sort"
                                                            color={ON_DARK_MUTED}
                                                        />
                                                    )}
                                                </View>
                                            </View>
                                            {!!d.fuzzy?.priority && (
                                                <View
                                                    style={[
                                                        styles.priorityDot,
                                                        { backgroundColor: priorityColor(d.fuzzy.priority) },
                                                    ]}
                                                />
                                            )}
                                            <TouchableOpacity
                                                onPress={() => removeDraft(d.id)}
                                                disabled={submitting}
                                                hitSlop={8}
                                                accessibilityLabel={`Remove ${d.content}`}>
                                                <X size={16} color={ON_DARK_MUTED} weight="bold" />
                                            </TouchableOpacity>
                                        </>
                                    );
                                })()}
                            </Glass>
                        </Reanimated.View>
                    ))}

                    {/* Ghosted examples stacked above the field until there's something of your own */}
                    {/* Held back while predictions load, so examples never swap out under the user */}
                    {!hasText && !listening && !predictionsPending && (isPersonal || drafts.length === 0) && (
                        <View
                            // Plain View on purpose: this unmounts on the first keystroke, and
                            // Reanimated exiting animations inside a Modal can crash on iOS
                            style={styles.starters}>
                            {isPersonal ? (
                                <>
                                    <SectionTitle title="Suggested for you" style={{ color: ON_DARK }} />
                                    {/* New tasks predicted from the user's own patterns, each saying why */}
                                    {personal.map((s) => (
                                        <TouchableOpacity
                                            key={s.content}
                                            onPress={() => stageDraft(s.content, s.categoryId)}
                                            disabled={submitting}
                                            activeOpacity={0.6}
                                            accessibilityRole="button"
                                            accessibilityLabel={`Add ${s.content}`}
                                            accessibilityHint={s.reason}>
                                            <Glass interactive style={styles.suggestionCard}>
                                                <View style={styles.fill}>
                                                    <ThemedText type="default" style={styles.suggestion}>
                                                        {s.content}
                                                    </ThemedText>
                                                    <ThemedText type="caption" style={styles.suggestionReason}>
                                                        {s.reason}
                                                    </ThemedText>
                                                </View>
                                                <Plus size={16} color={ON_DARK} weight="bold" />
                                            </Glass>
                                        </TouchableOpacity>
                                    ))}
                                </>
                            ) : (
                                CAPTURE_STARTERS.map((starter) => (
                                    <TouchableOpacity key={starter} onPress={() => applyStarter(starter)} hitSlop={4}>
                                        <ThemedText type="default" style={styles.starter}>
                                            {starter}
                                        </ThemedText>
                                    </TouchableOpacity>
                                ))
                            )}
                        </View>
                    )}

                    <Reanimated.View layout={PILE_TRANSITION}>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            keyboardShouldPersistTaps="always"
                            contentContainerStyle={styles.chips}>
                            {preview !== "" && (
                                <View
                                    style={[
                                        styles.chip,
                                        {
                                            backgroundColor: ThemedColor.primary + "33",
                                        },
                                    ]}>
                                    <CalendarBlank size={14} color={ON_DARK} weight="bold" />
                                    <ThemedText type="caption" style={styles.chipText}>
                                        {preview}
                                    </ThemedText>
                                </View>
                            )}
                            {priorityLabel !== "" && (
                                <Glass style={styles.chip}>
                                    <Flag size={14} color={ON_DARK} weight="bold" />
                                    <ThemedText type="caption" style={styles.chipText}>
                                        {priorityLabel}
                                    </ThemedText>
                                </Glass>
                            )}
                            {/* Quick dates only once there's something to date, and not when one's already parsed */}
                            {hasText &&
                                preview === "" &&
                                QUICK_WHEN.map((phrase) => (
                                    <TouchableOpacity key={phrase} onPress={() => appendWhen(phrase)}>
                                        <Glass interactive style={styles.chip}>
                                            <ThemedText type="caption" style={styles.chipText}>
                                                {phrase.charAt(0).toUpperCase() + phrase.slice(1)}
                                            </ThemedText>
                                        </Glass>
                                    </TouchableOpacity>
                                ))}
                        </ScrollView>
                    </Reanimated.View>

                    <Reanimated.View layout={PILE_TRANSITION} style={styles.composer}>
                        <TextInput
                            ref={inputRef}
                            multiline
                            submitBehavior="submit"
                            value={text}
                            onChangeText={setText}
                            onSubmitEditing={addDraft}
                            editable={!listening}
                            placeholder={listening ? "Listening..." : drafts.length ? "Add another" : "Add a task"}
                            placeholderTextColor={ON_DARK_MUTED}
                            returnKeyType="next"
                            keyboardAppearance="dark"
                            selectionColor={ThemedColor.primary}
                            style={styles.input}
                        />
                        <View style={styles.actions}>
                            {listening ? (
                                <VoiceWaveform level={volume} active={listening} style={styles.waveform} />
                            ) : (
                                <View style={styles.fill}>
                                    {confirmCount > 0 && (
                                        <PrimaryButton
                                            title={
                                                submitting
                                                    ? "Adding..."
                                                    : confirmCount === 1
                                                      ? "Add task"
                                                      : `Add ${confirmCount} tasks`
                                            }
                                            onPress={confirm}
                                            disabled={submitting}
                                            style={{ ...styles.confirm, shadowColor: ThemedColor.primary }}
                                        />
                                    )}
                                </View>
                            )}
                            <TouchableOpacity
                                onPress={toggleMic}
                                hitSlop={8}
                                accessibilityLabel={listening ? "Stop listening" : "Add by voice"}
                                style={[styles.iconButton, listening && { backgroundColor: ON_DARK }]}>
                                {listening ? (
                                    <Stop size={16} color="#000" weight="fill" />
                                ) : (
                                    <Microphone size={18} color={ON_DARK} weight="bold" />
                                )}
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={addDraft}
                                disabled={!canAdd}
                                hitSlop={8}
                                accessibilityLabel="Add to list"
                                style={[styles.iconButton, { opacity: canAdd ? 1 : 0.4 }]}>
                                <ArrowUp size={16} color={ON_DARK} weight="bold" />
                            </TouchableOpacity>
                        </View>
                    </Reanimated.View>
                </Reanimated.View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    fill: { flex: 1 },
    stack: {
        flex: 1,
        justifyContent: "flex-end",
        paddingHorizontal: 16,
        gap: 12,
    },
    draft: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        borderRadius: 16,
        overflow: "hidden",
        paddingLeft: 12,
        paddingRight: 16,
        paddingVertical: 12,
    },
    // Square-cornered and inset from the card edge, never a bent borderLeft
    categoryBar: { width: 4, alignSelf: "stretch" },
    metaRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12 },
    draftText: { flex: 1, gap: 2 },
    draftTitle: { color: ON_DARK, lineHeight: 24 },
    priorityDot: { width: 10, height: 10, borderRadius: 10 },
    // PrimaryButton, sized to its label, with the hero-action glow
    confirm: {
        width: "auto",
        alignSelf: "flex-start",
        paddingVertical: 8,
        paddingHorizontal: 16,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 6,
    },
    chips: {
        gap: 8,
        alignItems: "center",
        paddingHorizontal: 4,
    },
    chip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        borderRadius: 100,
        overflow: "hidden",
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    chipText: { color: ON_DARK },
    starters: { gap: 12, paddingHorizontal: 4, paddingBottom: 4 },
    suggestionCard: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 16,
    },
    suggestion: { color: ON_DARK },
    suggestionReason: { color: ON_DARK_MUTED },
    starter: { color: ON_DARK_MUTED, opacity: 0.8, fontFamily: "OutfitLight" },
    hint: { color: ON_DARK_MUTED },
    // No card: the text sits straight on the gradient, like a heading being written
    composer: {
        paddingTop: 8,
        paddingHorizontal: 4,
        gap: 16,
    },
    input: {
        color: ON_DARK,
        fontSize: 24,
        fontWeight: 600,
        fontFamily: "Fraunces",
        letterSpacing: -1,
        minHeight: 32,
        maxHeight: 160,
        padding: 0,
        textAlignVertical: "top",
    },
    actions: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    waveform: { flex: 1, justifyContent: "flex-start" },
    iconButton: {
        width: 36,
        height: 36,
        borderRadius: 100,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: GLASS,
    },
});
