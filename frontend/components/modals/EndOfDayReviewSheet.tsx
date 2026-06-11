import React, { useState } from "react";
import { ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from "react-native";
import { CheckCircleIcon, CircleIcon, PlusCircleIcon, XCircleIcon } from "phosphor-react-native";
import { useQueryClient } from "@tanstack/react-query";
import DefaultModal from "./DefaultModal";
import { ThemedText } from "@/components/ThemedText";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useTasks } from "@/contexts/tasksContext";
import { bulkCompleteTasksAPI, logTasksAPI } from "@/api/task";
import { runEndOfDaySubmission } from "@/utils/endOfDay";
import { showToast } from "@/utils/showToast";
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

interface Props {
    visible: boolean;
    setVisible: (visible: boolean) => void;
    openTasks: Task[];
    onLogged: () => void;
}

export default function EndOfDayReviewSheet({ visible, setVisible, openTasks, onLogged }: Props) {
    const ThemedColor = useThemeColor();
    const queryClient = useQueryClient();
    const { workspaces, selected, removeFromCategory, fetchWorkspaces } = useTasks();

    const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
    const [entries, setEntries] = useState<string[]>([]);
    const [draft, setDraft] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const workspaceName = selected || workspaces.find((ws) => !ws.isBlueprint)?.name || workspaces[0]?.name;

    const toggleTask = (taskId: string) => {
        setCheckedIds((prev) => {
            const next = new Set(prev);
            if (next.has(taskId)) next.delete(taskId);
            else next.add(taskId);
            return next;
        });
    };

    const addEntry = () => {
        const content = draft.trim();
        if (!content) return;
        setEntries((prev) => [...prev, content]);
        setDraft("");
    };

    const removeEntry = (index: number) => {
        setEntries((prev) => prev.filter((_, i) => i !== index));
    };

    const canSubmit = !submitting && (checkedIds.size > 0 || entries.length > 0 || draft.trim().length > 0);

    const handleSubmit = async () => {
        // Pull in an un-added draft so "type and hit Log" works without tapping +.
        const pendingEntries = draft.trim() ? [...entries, draft.trim()] : entries;
        const checkedTasks = openTasks.filter((t) => t.id && checkedIds.has(t.id));

        setSubmitting(true);
        try {
            const result = await runEndOfDaySubmission(checkedTasks, pendingEntries, workspaceName, {
                bulkComplete: bulkCompleteTasksAPI,
                logTasks: logTasksAPI,
            });

            result.confirmedCompletions.forEach(({ taskId, categoryId }) => removeFromCategory(categoryId, taskId));
            setEntries(result.remainingEntries);
            setDraft("");
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
        } catch (error) {
            console.error("End of day review failed:", error);
            showToast("Couldn't log your day. Please try again.", "danger");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <DefaultModal visible={visible} setVisible={setVisible}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <ThemedText type="fancyFrauncesHeading" style={styles.heading}>
                    How did today go?
                </ThemedText>

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
                    <View style={styles.inputRow}>
                        <TextInput
                            style={[styles.input, { color: ThemedColor.text, borderColor: ThemedColor.tertiary }]}
                            placeholder="e.g. went to the gym"
                            placeholderTextColor={ThemedColor.caption}
                            value={draft}
                            onChangeText={setDraft}
                            onSubmitEditing={addEntry}
                            returnKeyType="done"
                            submitBehavior="submit"
                        />
                        <TouchableOpacity onPress={addEntry} hitSlop={8}>
                            <PlusCircleIcon size={28} color={ThemedColor.primary} />
                        </TouchableOpacity>
                    </View>
                </View>

                <PrimaryButton
                    title={submitting ? "Logging…" : "Log my day"}
                    onPress={handleSubmit}
                    disabled={!canSubmit}
                />
            </ScrollView>
        </DefaultModal>
    );
}

const styles = StyleSheet.create({
    heading: {
        marginBottom: 16,
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
    inputRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        marginTop: 4,
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
