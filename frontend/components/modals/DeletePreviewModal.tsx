import React, { useState, useCallback } from "react";
import {
    View,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
} from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import DefaultModal from "./DefaultModal";
import type { components } from "@/api/generated/types";
import { bulkDeleteTasksAPI } from "@/api/task";
import Ionicons from "@expo/vector-icons/Ionicons";

type TaskDocument = components["schemas"]["TaskDocument"];

interface DeletePreviewModalProps {
    visible: boolean;
    tasks: TaskDocument[];
    onClose: () => void;
    onDeleted: () => void;
}

const PRIORITY_LABELS: Record<number, string> = { 1: "Low", 2: "Medium", 3: "High" };

export default function DeletePreviewModal({
    visible,
    tasks,
    onClose,
    onDeleted,
}: DeletePreviewModalProps) {
    const ThemedColor = useThemeColor();
    const [selected, setSelected] = useState<Set<string>>(() => new Set(tasks.map((t) => t.id)));
    const [isDeleting, setIsDeleting] = useState(false);
    const [deletedCount, setDeletedCount] = useState<number | null>(null);

    // Reset state whenever a fresh set of tasks arrives
    React.useEffect(() => {
        setSelected(new Set(tasks.map((t) => t.id)));
        setIsDeleting(false);
        setDeletedCount(null);
    }, [tasks]);

    const toggleTask = useCallback((id: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    }, []);

    const handleDelete = async () => {
        const toDelete = tasks.filter((t) => selected.has(t.id));
        if (toDelete.length === 0) return;

        setIsDeleting(true);
        try {
            const result = await bulkDeleteTasksAPI(
                toDelete.map((t) => ({
                    taskId: t.id,
                    categoryId: t.categoryID || "",
                    deleteRecurring: false,
                }))
            );
            setDeletedCount(result.totalDeleted);
            onDeleted();
        } catch {
            // fall through — modal stays open so user can retry
        } finally {
            setIsDeleting(false);
        }
    };

    const selectedCount = selected.size;

    return (
        <DefaultModal visible={visible} setVisible={(v) => { if (!v) onClose(); }} enableDynamicSizing>
            <View style={styles.container}>
                <ThemedText style={[styles.title, { color: ThemedColor.text }]}>
                    Delete Tasks
                </ThemedText>

                {tasks.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Ionicons name="search-outline" size={36} color={ThemedColor.caption} />
                        <ThemedText style={[styles.emptyText, { color: ThemedColor.caption }]}>
                            No tasks found matching that description
                        </ThemedText>
                    </View>
                ) : deletedCount !== null ? (
                    <View style={styles.emptyState}>
                        <Ionicons name="checkmark-circle-outline" size={36} color={ThemedColor.primary} />
                        <ThemedText style={[styles.emptyText, { color: ThemedColor.text }]}>
                            {deletedCount} {deletedCount === 1 ? "task" : "tasks"} deleted
                        </ThemedText>
                    </View>
                ) : (
                    <>
                        <ThemedText style={[styles.subtitle, { color: ThemedColor.caption }]}>
                            Deselect tasks you want to keep, then confirm.
                        </ThemedText>

                        <ScrollView
                            style={styles.list}
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={styles.listContent}
                        >
                            {tasks.map((task) => {
                                const isChecked = selected.has(task.id);
                                return (
                                    <TouchableOpacity
                                        key={task.id}
                                        style={[
                                            styles.taskRow,
                                            { borderColor: ThemedColor.bottomBorder },
                                            isChecked && styles.taskRowSelected,
                                        ]}
                                        onPress={() => toggleTask(task.id)}
                                        activeOpacity={0.7}
                                    >
                                        <View
                                            style={[
                                                styles.checkbox,
                                                {
                                                    borderColor: isChecked
                                                        ? ThemedColor.error
                                                        : ThemedColor.caption,
                                                    backgroundColor: isChecked
                                                        ? ThemedColor.error
                                                        : "transparent",
                                                },
                                            ]}
                                        >
                                            {isChecked && (
                                                <Ionicons name="checkmark" size={12} color="#fff" />
                                            )}
                                        </View>
                                        <View style={styles.taskInfo}>
                                            <ThemedText
                                                style={[styles.taskContent, { color: ThemedColor.text }]}
                                                numberOfLines={2}
                                            >
                                                {task.content}
                                            </ThemedText>
                                            <View style={styles.taskMeta}>
                                                {task.priority !== undefined && (
                                                    <ThemedText
                                                        style={[
                                                            styles.metaChip,
                                                            { color: ThemedColor.caption },
                                                        ]}
                                                    >
                                                        {PRIORITY_LABELS[task.priority] ?? "—"} priority
                                                    </ThemedText>
                                                )}
                                                {task.deadline && (
                                                    <ThemedText
                                                        style={[
                                                            styles.metaChip,
                                                            { color: ThemedColor.caption },
                                                        ]}
                                                    >
                                                        Due {new Date(task.deadline).toLocaleDateString()}
                                                    </ThemedText>
                                                )}
                                            </View>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>

                        <View style={styles.footer}>
                            <TouchableOpacity
                                style={[styles.cancelBtn, { borderColor: ThemedColor.bottomBorder }]}
                                onPress={onClose}
                                disabled={isDeleting}
                            >
                                <ThemedText style={[styles.cancelBtnText, { color: ThemedColor.text }]}>
                                    Cancel
                                </ThemedText>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[
                                    styles.deleteBtn,
                                    {
                                        backgroundColor:
                                            selectedCount === 0
                                                ? ThemedColor.caption
                                                : ThemedColor.error,
                                    },
                                ]}
                                onPress={handleDelete}
                                disabled={isDeleting || selectedCount === 0}
                                activeOpacity={0.85}
                            >
                                {isDeleting ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <ThemedText style={styles.deleteBtnText}>
                                        Delete {selectedCount > 0 ? `${selectedCount} ` : ""}
                                        {selectedCount === 1 ? "Task" : "Tasks"}
                                    </ThemedText>
                                )}
                            </TouchableOpacity>
                        </View>
                    </>
                )}
            </View>
        </DefaultModal>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 24,
        gap: 12,
    },
    title: {
        fontSize: 20,
        fontWeight: "700",
        letterSpacing: -0.3,
    },
    subtitle: {
        fontSize: 13,
        lineHeight: 18,
    },
    list: {
        maxHeight: 340,
    },
    listContent: {
        gap: 8,
        paddingBottom: 4,
    },
    taskRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 12,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 10,
        borderWidth: 1,
    },
    taskRowSelected: {
        backgroundColor: "rgba(239,68,68,0.06)",
        borderColor: "rgba(239,68,68,0.3)",
    },
    checkbox: {
        width: 20,
        height: 20,
        borderRadius: 5,
        borderWidth: 1.5,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 1,
        flexShrink: 0,
    },
    taskInfo: {
        flex: 1,
        gap: 4,
    },
    taskContent: {
        fontSize: 14,
        fontWeight: "500",
        lineHeight: 20,
    },
    taskMeta: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 6,
    },
    metaChip: {
        fontSize: 11,
        fontWeight: "500",
    },
    emptyState: {
        alignItems: "center",
        paddingVertical: 32,
        gap: 12,
    },
    emptyText: {
        fontSize: 14,
        textAlign: "center",
        lineHeight: 20,
    },
    footer: {
        flexDirection: "row",
        gap: 10,
        marginTop: 4,
    },
    cancelBtn: {
        flex: 1,
        height: 46,
        borderRadius: 12,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    cancelBtnText: {
        fontSize: 15,
        fontWeight: "600",
    },
    deleteBtn: {
        flex: 2,
        height: 46,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
    },
    deleteBtnText: {
        fontSize: 15,
        fontWeight: "600",
        color: "#fff",
    },
});
