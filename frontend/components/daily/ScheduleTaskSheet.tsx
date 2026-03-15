import React, { useState } from "react";
import {
    View,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import DefaultModal from "@/components/modals/DefaultModal";
import { updateTaskStartAPI, updateTaskDeadlineAPI } from "@/api/task";
import { useTasks } from "@/contexts/tasksContext";
import { getCategoryDuotoneColors } from "@/utils/categoryColors";
import { logger } from "@/utils/logger";
import { ArrowLeft } from "phosphor-react-native";
import * as Haptics from "expo-haptics";
import type { ScheduleTimeRange } from "./CalendarView";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

type SheetPage = "actions" | "workspace-select";

interface ScheduleTaskSheetProps {
    visible: boolean;
    setVisible: (visible: boolean) => void;
    timeRange: ScheduleTimeRange | null;
    selectedDate: Date;
    tasksUnscheduled: any[];
    onCreateNew: (startTime: Date, endTime: Date, workspaceName: string) => void;
}

const formatMinutesToTime = (totalMinutes: number): string => {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    const ampm = h >= 12 ? "PM" : "AM";
    const dh = h % 12 || 12;
    return `${dh}:${m.toString().padStart(2, "0")} ${ampm}`;
};

const minutesToDate = (baseDate: Date, totalMinutes: number): Date => {
    const d = new Date(baseDate);
    d.setHours(Math.floor(totalMinutes / 60), totalMinutes % 60, 0, 0);
    return d;
};

export const ScheduleTaskSheet: React.FC<ScheduleTaskSheetProps> = ({
    visible,
    setVisible,
    timeRange,
    selectedDate,
    tasksUnscheduled,
    onCreateNew,
}) => {
    const ThemedColor = useThemeColor();
    const { workspaces, selected, updateTask } = useTasks();
    const [schedulingTaskId, setSchedulingTaskId] = useState<string | null>(
        null
    );
    const [page, setPage] = useState<SheetPage>("actions");

    const filteredWorkspaces = workspaces.filter((w) => !w.isBlueprint);

    const handleClose = (v: boolean) => {
        setVisible(v);
        if (!v) setPage("actions");
    };

    if (!timeRange) return null;

    const startTime = minutesToDate(selectedDate, timeRange.startMinutes);
    const endTime = minutesToDate(selectedDate, timeRange.endMinutes);
    const timeLabel = `${formatMinutesToTime(timeRange.startMinutes)} - ${formatMinutesToTime(timeRange.endMinutes)}`;

    const durationMinutes = timeRange.endMinutes - timeRange.startMinutes;
    const durationLabel =
        durationMinutes >= 60
            ? `${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60 > 0 ? `${durationMinutes % 60}m` : ""}`
            : `${durationMinutes}m`;

    const handleCreateNewPressed = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setPage("workspace-select");
    };

    const handleWorkspaceSelect = (workspaceName: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        handleClose(false);
        onCreateNew(startTime, endTime, workspaceName);
    };

    const handleScheduleExisting = async (task: any) => {
        if (!task.id || !task.categoryID) return;

        setSchedulingTaskId(task.id);
        try {
            updateTask(task.categoryID, task.id, {
                startDate: startTime.toISOString(),
                startTime: startTime.toISOString(),
                deadline: endTime.toISOString(),
            });

            await Promise.all([
                updateTaskStartAPI(
                    task.categoryID,
                    task.id,
                    startTime,
                    startTime
                ),
                updateTaskDeadlineAPI(task.categoryID, task.id, endTime),
            ]);

            handleClose(false);
        } catch (error) {
            logger.error("Failed to schedule task", error);
            updateTask(task.categoryID, task.id, {
                startDate: task.startDate || null,
                startTime: task.startTime || null,
                deadline: task.deadline || null,
            });
        } finally {
            setSchedulingTaskId(null);
        }
    };

    return (
        <DefaultModal
            visible={visible}
            setVisible={handleClose}
            enableDynamicSizing={true}
            enablePanDownToClose={true}
        >
            <View style={sheetStyles.container}>
                {/* Time Range Header — always visible */}
                <View style={sheetStyles.header}>
                    <View
                        style={[
                            sheetStyles.timeBadge,
                            { backgroundColor: `${ThemedColor.primary}15` },
                        ]}
                    >
                        <Ionicons
                            name="time-outline"
                            size={18}
                            color={ThemedColor.primary}
                        />
                        <ThemedText
                            type="defaultSemiBold"
                            style={{ color: ThemedColor.primary }}
                        >
                            {timeLabel}
                        </ThemedText>
                        <ThemedText
                            type="caption"
                            style={{
                                color: ThemedColor.primary,
                                opacity: 0.7,
                            }}
                        >
                            ({durationLabel.trim()})
                        </ThemedText>
                    </View>
                </View>

                {page === "actions" && (
                    <>
                        {/* Create New Task */}
                        <TouchableOpacity
                            style={[
                                sheetStyles.createButton,
                                { backgroundColor: ThemedColor.primary },
                            ]}
                            onPress={handleCreateNewPressed}
                            activeOpacity={0.8}
                        >
                            <Ionicons
                                name="add-circle-outline"
                                size={22}
                                color="#fff"
                            />
                            <ThemedText
                                type="defaultSemiBold"
                                style={{ color: "#fff", marginLeft: 10 }}
                            >
                                Create New Task
                            </ThemedText>
                        </TouchableOpacity>

                        {/* Schedule Existing Task */}
                        {tasksUnscheduled.length > 0 && (
                            <View style={sheetStyles.existingSection}>
                                <ThemedText
                                    type="caption"
                                    style={{
                                        textTransform: "uppercase",
                                        letterSpacing: 0.5,
                                        marginBottom: 8,
                                    }}
                                >
                                    Or schedule an existing task
                                </ThemedText>
                                <ScrollView
                                    style={{ maxHeight: 240 }}
                                    showsVerticalScrollIndicator={false}
                                >
                                    {tasksUnscheduled.map((task) => {
                                        const colors = getCategoryDuotoneColors(
                                            task.categoryID,
                                            task.categoryName
                                        );
                                        const isScheduling =
                                            schedulingTaskId === task.id;

                                        return (
                                            <TouchableOpacity
                                                key={task.id}
                                                style={[
                                                    sheetStyles.taskRow,
                                                    {
                                                        borderColor:
                                                            ThemedColor.tertiary,
                                                        opacity: isScheduling
                                                            ? 0.5
                                                            : 1,
                                                    },
                                                ]}
                                                onPress={() =>
                                                    handleScheduleExisting(task)
                                                }
                                                disabled={isScheduling}
                                                activeOpacity={0.7}
                                            >
                                                <View
                                                    style={[
                                                        sheetStyles.categoryDot,
                                                        {
                                                            backgroundColor:
                                                                colors.dark,
                                                        },
                                                    ]}
                                                />
                                                <View style={{ flex: 1 }}>
                                                    <ThemedText
                                                        type="default"
                                                        numberOfLines={1}
                                                        style={{ fontSize: 14 }}
                                                    >
                                                        {task.content}
                                                    </ThemedText>
                                                    {task.categoryName && (
                                                        <ThemedText
                                                            type="caption"
                                                            style={{
                                                                fontSize: 11,
                                                            }}
                                                            numberOfLines={1}
                                                        >
                                                            {task.categoryName}
                                                            {task.workspaceName
                                                                ? ` · ${task.workspaceName}`
                                                                : ""}
                                                        </ThemedText>
                                                    )}
                                                </View>
                                                <Ionicons
                                                    name="arrow-forward-circle-outline"
                                                    size={22}
                                                    color={ThemedColor.caption}
                                                />
                                            </TouchableOpacity>
                                        );
                                    })}
                                </ScrollView>
                            </View>
                        )}
                    </>
                )}

                {page === "workspace-select" && (
                    <View>
                        <View style={sheetStyles.wsHeader}>
                            <TouchableOpacity
                                onPress={() => setPage("actions")}
                                style={sheetStyles.backButton}
                            >
                                <ArrowLeft
                                    size={20}
                                    color={ThemedColor.text}
                                    weight="bold"
                                />
                            </TouchableOpacity>
                            <View style={{ flex: 1 }}>
                                <ThemedText type="defaultSemiBold">
                                    Select Workspace
                                </ThemedText>
                                <ThemedText
                                    type="caption"
                                    style={{ marginTop: 2, fontSize: 13 }}
                                >
                                    Choose where to create your task
                                </ThemedText>
                            </View>
                        </View>

                        {filteredWorkspaces.length > 0 ? (
                            <ScrollView
                                style={{
                                    maxHeight: SCREEN_HEIGHT * 0.4,
                                }}
                                showsVerticalScrollIndicator={false}
                            >
                                {filteredWorkspaces.map((workspace) => (
                                    <TouchableOpacity
                                        key={workspace.name}
                                        style={[
                                            sheetStyles.wsItem,
                                            {
                                                backgroundColor:
                                                    selected === workspace.name
                                                        ? ThemedColor.lightened
                                                        : "transparent",
                                                borderColor:
                                                    ThemedColor.lightened,
                                            },
                                        ]}
                                        onPress={() =>
                                            handleWorkspaceSelect(
                                                workspace.name
                                            )
                                        }
                                        activeOpacity={0.7}
                                    >
                                        <ThemedText type="default">
                                            {workspace.name}
                                        </ThemedText>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        ) : (
                            <View style={{ paddingVertical: 16 }}>
                                <ThemedText
                                    type="caption"
                                    style={{ opacity: 0.6 }}
                                >
                                    No workspaces yet — create one first.
                                </ThemedText>
                            </View>
                        )}
                    </View>
                )}
            </View>
        </DefaultModal>
    );
};

const sheetStyles = StyleSheet.create({
    container: {
        paddingBottom: 16,
        gap: 16,
    },
    header: {
        alignItems: "center",
    },
    timeBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
    },
    createButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 14,
        borderRadius: 14,
    },
    existingSection: {
        marginTop: 4,
    },
    taskRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderRadius: 12,
        marginBottom: 8,
    },
    categoryDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    wsHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        marginBottom: 12,
    },
    backButton: {
        padding: 4,
    },
    wsItem: {
        padding: 16,
        paddingVertical: 18,
        borderRadius: 12,
        marginBottom: 4,
        borderWidth: 1,
    },
});
