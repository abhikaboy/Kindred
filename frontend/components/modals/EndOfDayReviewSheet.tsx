import React, { useCallback, useRef, useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
    BottomSheetFooter,
    BottomSheetScrollView,
    BottomSheetTextInput,
    type BottomSheetFooterProps,
    type BottomSheetScrollViewMethods,
} from "@gorhom/bottom-sheet";
import { CheckCircleIcon, CircleIcon, PlusCircleIcon, XCircleIcon } from "phosphor-react-native";
import { useQueryClient } from "@tanstack/react-query";
import * as Sentry from "@sentry/react-native";
import DefaultModal from "./DefaultModal";
import { ThemedText } from "@/components/ThemedText";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useTasks } from "@/contexts/tasksContext";
import { bulkCompleteTasksAPI, logTasksAPI } from "@/api/task";
import { runEndOfDaySubmission } from "@/utils/endOfDay";
import { showToast } from "@/utils/showToast";
import { useTimeouts } from "@/hooks/useTimeouts";
import type { Task } from "@/api/types";

interface OpenTaskRowProps {
    task: Task;
    checked: boolean;
    onToggle: () => void;
}

function OpenTaskRow({ task, checked, onToggle }: OpenTaskRowProps) {
    const ThemedColor = useThemeColor();
    return (
        <TouchableOpacity style={styles.row} onPress={onToggle} activeOpacity={0.7}>
            {checked ? (
                <CheckCircleIcon size={24} weight="fill" color={ThemedColor.primary} />
            ) : (
                <CircleIcon size={24} color={ThemedColor.caption} />
            )}
            <View style={styles.rowText}>
                <ThemedText type="default" numberOfLines={1}>
                    {task.content}
                </ThemedText>
                {task.categoryName ? (
                    <ThemedText type="caption" style={{ color: ThemedColor.caption }}>
                        {task.categoryName}
                    </ThemedText>
                ) : null}
            </View>
        </TouchableOpacity>
    );
}

interface PendingEntryRowProps {
    content: string;
    onRemove: () => void;
}

function PendingEntryRow({ content, onRemove }: PendingEntryRowProps) {
    const ThemedColor = useThemeColor();
    return (
        <View style={styles.row}>
            <CheckCircleIcon size={24} weight="fill" color={ThemedColor.success} />
            <View style={styles.rowText}>
                <ThemedText type="default" numberOfLines={1}>
                    {content}
                </ThemedText>
            </View>
            <TouchableOpacity onPress={onRemove} hitSlop={8}>
                <XCircleIcon size={22} color={ThemedColor.caption} />
            </TouchableOpacity>
        </View>
    );
}

interface DayLogFooterProps {
    footerProps: BottomSheetFooterProps;
    bottomInset: number;
    submitting: boolean;
    hasSelections: boolean;
    onAddEntry: (content: string) => void;
    onSubmit: (extraEntry: string) => Promise<boolean>;
}

// Composer lives in its own component with local draft state so the
// footerComponent identity stays stable as you type (a changing footerComponent
// remounts the input and drops keyboard focus). BottomSheetFooter keeps it
// above the keyboard — keyboardBehavior="extend" alone can't lift a
// bottom-pinned input on a fixed snap point.
function DayLogFooter({ footerProps, bottomInset, submitting, hasSelections, onAddEntry, onSubmit }: DayLogFooterProps) {
    const ThemedColor = useThemeColor();
    const [draft, setDraft] = useState("");

    const add = () => {
        const content = draft.trim();
        if (!content) return;
        onAddEntry(content);
        setDraft("");
    };

    const submit = async () => {
        const ok = await onSubmit(draft.trim());
        if (ok) setDraft("");
    };

    const canSubmit = !submitting && (hasSelections || draft.trim().length > 0);

    return (
        <BottomSheetFooter {...footerProps} bottomInset={bottomInset}>
            <View style={[styles.footer, { borderTopColor: ThemedColor.tertiary, backgroundColor: ThemedColor.background }]}>
                <PrimaryButton title={submitting ? "Logging…" : "Log my day"} onPress={submit} disabled={!canSubmit} />
                <View style={styles.inputRow}>
                    <BottomSheetTextInput
                        style={[styles.input, { color: ThemedColor.text, borderColor: ThemedColor.tertiary }]}
                        placeholder="e.g. went to the gym"
                        placeholderTextColor={ThemedColor.caption}
                        value={draft}
                        onChangeText={setDraft}
                        onSubmitEditing={add}
                        returnKeyType="done"
                        submitBehavior="submit"
                    />
                    <TouchableOpacity onPress={add} hitSlop={8}>
                        <PlusCircleIcon size={28} color={ThemedColor.primary} />
                    </TouchableOpacity>
                </View>
            </View>
        </BottomSheetFooter>
    );
}

interface Props {
    visible: boolean;
    setVisible: (visible: boolean) => void;
    openTasks: Task[];
    onLogged: () => void;
}

export default function EndOfDayReviewSheet({ visible, setVisible, openTasks, onLogged }: Props) {
    const ThemedColor = useThemeColor();
    const insets = useSafeAreaInsets();
    const queryClient = useQueryClient();
    const { workspaces, selected, removeFromCategory, fetchWorkspaces } = useTasks();
    const scrollRef = useRef<BottomSheetScrollViewMethods>(null);
    const setT = useTimeouts();

    const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
    const [entries, setEntries] = useState<string[]>([]);
    const [submitting, setSubmitting] = useState(false);

    const workspaceName = selected || workspaces.find((ws) => !ws.isBlueprint)?.name || workspaces[0]?.name;
    const hasSelections = checkedIds.size > 0 || entries.length > 0;

    // Latest values for the submit handler, so it can stay identity-stable (it
    // feeds renderFooter; an unstable handler would remount the composer).
    const submitDataRef = useRef({ openTasks, checkedIds, entries, workspaceName, removeFromCategory, fetchWorkspaces, onLogged });
    submitDataRef.current = { openTasks, checkedIds, entries, workspaceName, removeFromCategory, fetchWorkspaces, onLogged };

    const toggleTask = (taskId: string) => {
        setCheckedIds((prev) => {
            const next = new Set(prev);
            if (next.has(taskId)) next.delete(taskId);
            else next.add(taskId);
            return next;
        });
    };

    const handleAddEntry = useCallback((content: string) => {
        setEntries((prev) => [...prev, content]);
        // Reveal the just-added entry; keyboard stays up for the next one.
        setT(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    }, [setT]);

    const removeEntry = (index: number) => {
        setEntries((prev) => prev.filter((_, i) => i !== index));
    };

    // Returns true if the entry was consumed (so the composer can clear it).
    const handleSubmit = useCallback(
        async (extraEntry: string): Promise<boolean> => {
            const { openTasks, checkedIds, entries, workspaceName, removeFromCategory, fetchWorkspaces, onLogged } =
                submitDataRef.current;
            // Pull in an un-added draft so "type and hit Log" works without tapping +.
            const pendingEntries = extraEntry ? [...entries, extraEntry] : entries;
            const checkedTasks = openTasks.filter((t) => t.id && checkedIds.has(t.id));
            if (checkedTasks.length === 0 && pendingEntries.length === 0) return false;

            setSubmitting(true);
            try {
                const result = await runEndOfDaySubmission(checkedTasks, pendingEntries, workspaceName, {
                    bulkComplete: bulkCompleteTasksAPI,
                    logTasks: logTasksAPI,
                });

                result.confirmedCompletions.forEach(({ taskId, categoryId }) => removeFromCategory(categoryId, taskId));
                setEntries(result.remainingEntries);
                if (result.loggedCount > 0) fetchWorkspaces(true);
                queryClient.invalidateQueries({ queryKey: ["rings", "today"] });

                const total = result.completedCount + result.loggedCount;
                if (result.failedCount > 0) {
                    showToast(`${total} logged, ${result.failedCount} failed — try those again`, "warning");
                } else {
                    showToast(`Nice — ${total} task${total === 1 ? "" : "s"} logged for today`, "success");
                    onLogged();
                    setVisible(false);
                }
                return true;
            } catch (error) {
                // Catches client-side failures the backend never sees (offline, DNS).
                // Server-rejected requests (e.g. 422) are captured server-side in xsentry.
                console.error("End of day review failed:", error);
                Sentry.captureException(error, {
                    tags: { feature: "end-of-day-log" },
                    contexts: {
                        submission: {
                            checkedTasks: checkedTasks.length,
                            entries: pendingEntries.length,
                            workspaceName: workspaceName ?? "(none)",
                        },
                    },
                });
                showToast("Couldn't log your day. Please try again.", "danger");
                return false;
            } finally {
                setSubmitting(false);
            }
        },
        [queryClient, setVisible]
    );

    const renderFooter = useCallback(
        (props: BottomSheetFooterProps) => (
            <DayLogFooter
                footerProps={props}
                bottomInset={insets.bottom}
                submitting={submitting}
                hasSelections={hasSelections}
                onAddEntry={handleAddEntry}
                onSubmit={handleSubmit}
            />
        ),
        [insets.bottom, submitting, hasSelections, handleAddEntry, handleSubmit]
    );

    return (
        <DefaultModal
            visible={visible}
            setVisible={setVisible}
            enableContentPanningGesture={false}
            keyboardBehavior="extend"
            footerComponent={renderFooter}>
            <ThemedText type="fancyFrauncesSubheading" style={styles.heading}>
                How did today go?
            </ThemedText>

            <BottomSheetScrollView
                ref={scrollRef}
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator
                enableFooterMarginAdjustment
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag">
                {openTasks.length > 0 && (
                    <View style={styles.section}>
                        <ThemedText type="defaultSemiBold">Did you finish these?</ThemedText>
                        {openTasks.map((t) => (
                            <OpenTaskRow
                                key={t.id}
                                task={t}
                                checked={checkedIds.has(t.id)}
                                onToggle={() => toggleTask(t.id)}
                            />
                        ))}
                    </View>
                )}

                <View style={styles.section}>
                    <ThemedText type="defaultSemiBold">Anything else you got done?</ThemedText>
                    {entries.map((content, index) => (
                        <PendingEntryRow
                            key={`${content}-${index}`}
                            content={content}
                            onRemove={() => removeEntry(index)}
                        />
                    ))}
                </View>
            </BottomSheetScrollView>
        </DefaultModal>
    );
}

const styles = StyleSheet.create({
    heading: {
        marginBottom: 16,
    },
    // Flex so the list fills the space above the (absolutely-positioned) footer.
    scroll: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 8,
    },
    section: {
        marginBottom: 24,
        gap: 8,
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 8,
    },
    rowText: {
        flex: 1,
        gap: 2,
    },
    footer: {
        gap: 12,
        paddingTop: 12,
        paddingBottom: 8,
        paddingHorizontal: 20,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    inputRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    input: {
        flex: 1,
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontFamily: "Outfit",
        fontSize: 16,
    },
});
