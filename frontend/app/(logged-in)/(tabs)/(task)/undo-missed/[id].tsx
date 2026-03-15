import React, { useState } from "react";
import {
    View,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
} from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getTemplateByIDAPI, undoMissedTaskAPI } from "@/api/task";
import { showToast } from "@/utils/showToast";
import { X, CheckCircle, Fire, Warning } from "phosphor-react-native";
import * as Haptics from "expo-haptics";

export default function UndoMissedTaskScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const ThemedColor = useThemeColor();
    const queryClient = useQueryClient();
    const [isUndoing, setIsUndoing] = useState(false);
    const [undoResult, setUndoResult] = useState<{
        streak: number;
        highestStreak: number;
    } | null>(null);

    const {
        data: template,
        isLoading,
        error,
    } = useQuery({
        queryKey: ["template", id],
        queryFn: () => getTemplateByIDAPI(id!),
        enabled: !!id,
    });

    const canUndo = template?.lastMissedAt != null && !undoResult;

    const handleUndo = async () => {
        if (!id || isUndoing) return;
        setIsUndoing(true);
        try {
            const result = await undoMissedTaskAPI(id);
            setUndoResult(result);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            showToast("Task marked as completed!", "success");
            queryClient.invalidateQueries({ queryKey: ["template", id] });
            queryClient.invalidateQueries({ queryKey: ["templates"] });
        } catch (err: any) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            if (err.message?.includes("expired")) {
                showToast(
                    "The undo window has expired (24 hours).",
                    "warning"
                );
            } else if (err.message?.includes("no recent miss")) {
                showToast("No recent miss to undo for this task.", "warning");
            } else {
                showToast("Failed to undo. Please try again.", "danger");
            }
        } finally {
            setIsUndoing(false);
        }
    };

    if (isLoading) {
        return (
            <View
                style={[
                    styles.container,
                    { backgroundColor: ThemedColor.background },
                ]}
            >
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={() => router.back()}
                        style={styles.backButton}
                    >
                        <X size={24} color={ThemedColor.text} weight="bold" />
                    </TouchableOpacity>
                </View>
                <View style={styles.centerContainer}>
                    <ActivityIndicator
                        size="large"
                        color={ThemedColor.primary}
                    />
                </View>
            </View>
        );
    }

    if (error || !template) {
        return (
            <View
                style={[
                    styles.container,
                    { backgroundColor: ThemedColor.background },
                ]}
            >
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={() => router.back()}
                        style={styles.backButton}
                    >
                        <X size={24} color={ThemedColor.text} weight="bold" />
                    </TouchableOpacity>
                </View>
                <View style={styles.centerContainer}>
                    <Warning
                        size={48}
                        color={ThemedColor.caption}
                        weight="light"
                    />
                    <ThemedText
                        type="subtitle"
                        style={{
                            color: ThemedColor.caption,
                            textAlign: "center",
                            marginTop: 16,
                        }}
                    >
                        Task not found
                    </ThemedText>
                </View>
            </View>
        );
    }

    return (
        <View
            style={[
                styles.container,
                { backgroundColor: ThemedColor.background },
            ]}
        >
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={styles.backButton}
                >
                    <X size={24} color={ThemedColor.text} weight="bold" />
                </TouchableOpacity>
                <ThemedText type="defaultSemiBold" style={styles.headerTitle}>
                    Missed Task
                </ThemedText>
                <View style={styles.placeholder} />
            </View>

            <View style={styles.content}>
                <View
                    style={[
                        styles.card,
                        {
                            backgroundColor: ThemedColor.lightenedCard,
                            borderColor: ThemedColor.tertiary,
                        },
                    ]}
                >
                    <ThemedText type="title" style={styles.taskName}>
                        {template.content}
                    </ThemedText>

                    <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                            <Fire
                                size={20}
                                color={ThemedColor.primary}
                                weight="fill"
                            />
                            <ThemedText
                                type="default"
                                style={{ color: ThemedColor.caption }}
                            >
                                {undoResult
                                    ? `${undoResult.streak}d streak`
                                    : template.streak > 0
                                      ? `${template.streak}d streak`
                                      : "Streak lost"}
                            </ThemedText>
                        </View>
                        <View style={styles.statItem}>
                            <CheckCircle
                                size={20}
                                color={ThemedColor.primary}
                                weight="fill"
                            />
                            <ThemedText
                                type="default"
                                style={{ color: ThemedColor.caption }}
                            >
                                {template.timesCompleted} completed
                            </ThemedText>
                        </View>
                    </View>

                    {template.lastMissedAt && !undoResult && (
                        <ThemedText
                            type="caption"
                            style={{
                                color: ThemedColor.caption,
                                marginTop: 12,
                            }}
                        >
                            Missed{" "}
                            {formatTimeSince(new Date(template.lastMissedAt))}
                        </ThemedText>
                    )}
                </View>

                {undoResult ? (
                    <View style={styles.successContainer}>
                        <CheckCircle
                            size={64}
                            color={ThemedColor.primary}
                            weight="fill"
                        />
                        <ThemedText
                            type="subtitle"
                            style={{ textAlign: "center", marginTop: 16 }}
                        >
                            Marked as completed!
                        </ThemedText>
                        <ThemedText
                            type="default"
                            style={{
                                color: ThemedColor.caption,
                                textAlign: "center",
                                marginTop: 8,
                            }}
                        >
                            Your streak has been restored to{" "}
                            {undoResult.streak} days.
                        </ThemedText>
                        <TouchableOpacity
                            style={[
                                styles.button,
                                { backgroundColor: ThemedColor.primary },
                            ]}
                            onPress={() => router.back()}
                        >
                            <ThemedText
                                type="defaultSemiBold"
                                style={styles.buttonText}
                            >
                                Done
                            </ThemedText>
                        </TouchableOpacity>
                    </View>
                ) : canUndo ? (
                    <View style={styles.actionContainer}>
                        <ThemedText
                            type="default"
                            style={{
                                color: ThemedColor.caption,
                                textAlign: "center",
                                marginBottom: 24,
                            }}
                        >
                            Did you actually complete this task? You can mark it
                            as done and restore your streak.
                        </ThemedText>
                        <TouchableOpacity
                            style={[
                                styles.button,
                                { backgroundColor: ThemedColor.primary },
                            ]}
                            onPress={handleUndo}
                            disabled={isUndoing}
                        >
                            {isUndoing ? (
                                <ActivityIndicator
                                    size="small"
                                    color="#FFFFFF"
                                />
                            ) : (
                                <ThemedText
                                    type="defaultSemiBold"
                                    style={styles.buttonText}
                                >
                                    I Actually Did This
                                </ThemedText>
                            )}
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.actionContainer}>
                        <Warning
                            size={32}
                            color={ThemedColor.caption}
                            weight="light"
                        />
                        <ThemedText
                            type="default"
                            style={{
                                color: ThemedColor.caption,
                                textAlign: "center",
                                marginTop: 12,
                            }}
                        >
                            The undo window for this task has expired or there
                            is no recent miss to undo.
                        </ThemedText>
                    </View>
                )}
            </View>
        </View>
    );
}

function formatTimeSince(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 1) return "just now";
    if (diffMins < 60)
        return `${diffMins} minute${diffMins === 1 ? "" : "s"} ago`;
    if (diffHours < 24)
        return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
    return "over a day ago";
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 16,
        paddingTop: 60,
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 20,
    },
    placeholder: {
        width: 40,
    },
    centerContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 32,
    },
    content: {
        flex: 1,
        paddingHorizontal: 24,
        paddingTop: 16,
    },
    card: {
        padding: 24,
        borderRadius: 16,
        borderWidth: 1,
    },
    taskName: {
        fontSize: 22,
        marginBottom: 16,
    },
    statsRow: {
        flexDirection: "row",
        gap: 20,
    },
    statItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    successContainer: {
        alignItems: "center",
        marginTop: 48,
    },
    actionContainer: {
        alignItems: "center",
        marginTop: 32,
    },
    button: {
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 12,
        alignItems: "center",
        marginTop: 24,
        width: "100%",
    },
    buttonText: {
        color: "#FFFFFF",
        fontSize: 16,
    },
});
