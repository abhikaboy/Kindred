import React, { useState } from "react";
import { View, TouchableOpacity } from "react-native";
import { ThemedText } from "../ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import DeadlineBottomSheetModal from "./DeadlineBottomSheetModal";
import StartDateBottomSheetModal from "./StartDateBottomSheetModal";
import ReminderBottomSheetModal from "./ReminderBottomSheetModal";

/**
 * Demo component showing how to use the specialized BottomSheet modals
 * for editing task deadline, start date/time, and reminders
 */
const TaskEditBottomSheetDemo = () => {
    const ThemedColor = useThemeColor();
    
    // State for controlling modal visibility
    const [showDeadlineModal, setShowDeadlineModal] = useState(false);
    const [showStartDateModal, setShowStartDateModal] = useState(false);
    const [showReminderModal, setShowReminderModal] = useState(false);
    
    // Example task data
    const taskId = "507f1f77bcf86cd799439011";
    const categoryId = "507f1f77bcf86cd799439012";
    
    // Example state for current values
    const [currentDeadline, setCurrentDeadline] = useState<Date | null>(null);
    const [currentStartDate, setCurrentStartDate] = useState<Date | null>(null);
    const [currentReminders, setCurrentReminders] = useState<any[]>([]);

    const handleDeadlineUpdate = (deadline: Date | null) => {
        setCurrentDeadline(deadline);
        console.log("Deadline updated:", deadline);
        // Here you would typically call your API
        // await updateTaskDeadline(categoryId, taskId, { deadline });
    };

    const handleStartDateUpdate = (startDate: Date | null, startTime?: Date | null) => {
        setCurrentStartDate(startDate);
        console.log("Start date updated:", startDate, startTime);
        // Here you would typically call your API
        // await updateTaskStart(categoryId, taskId, { startDate, startTime });
    };

    const handleReminderUpdate = (reminders: any[]) => {
        setCurrentReminders(reminders);
        console.log("Reminders updated:", reminders);
        // Here you would typically call your API
        // await updateTaskReminders(categoryId, taskId, { reminders });
    };

    return (
        <View style={{ padding: 20, gap: 16 }}>
            <ThemedText type="title">Task Edit Demo</ThemedText>
            
            <TouchableOpacity
                onPress={() => setShowDeadlineModal(true)}
                style={{
                    padding: 16,
                    backgroundColor: ThemedColor.lightened,
                    borderRadius: 8,
                }}>
                <ThemedText type="defaultSemiBold">Set Deadline</ThemedText>
                <ThemedText type="caption">
                    {currentDeadline ? currentDeadline.toLocaleString() : "No deadline set"}
                </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
                onPress={() => setShowStartDateModal(true)}
                style={{
                    padding: 16,
                    backgroundColor: ThemedColor.lightened,
                    borderRadius: 8,
                }}>
                <ThemedText type="defaultSemiBold">Set Start Date</ThemedText>
                <ThemedText type="caption">
                    {currentStartDate ? currentStartDate.toLocaleString() : "No start date set"}
                </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
                onPress={() => setShowReminderModal(true)}
                style={{
                    padding: 16,
                    backgroundColor: ThemedColor.lightened,
                    borderRadius: 8,
                }}>
                <ThemedText type="defaultSemiBold">Set Reminders</ThemedText>
                <ThemedText type="caption">
                    {currentReminders.length > 0 ? `${currentReminders.length} reminder(s) set` : "No reminders set"}
                </ThemedText>
            </TouchableOpacity>

            {/* Specialized BottomSheet Modals */}
            <DeadlineBottomSheetModal
                visible={showDeadlineModal}
                setVisible={setShowDeadlineModal}
                taskId={taskId}
                categoryId={categoryId}
                onDeadlineUpdate={handleDeadlineUpdate}
            />

            <StartDateBottomSheetModal
                visible={showStartDateModal}
                setVisible={setShowStartDateModal}
                taskId={taskId}
                categoryId={categoryId}
                onStartDateUpdate={handleStartDateUpdate}
            />

            <ReminderBottomSheetModal
                visible={showReminderModal}
                setVisible={setShowReminderModal}
                taskId={taskId}
                categoryId={categoryId}
                onReminderUpdate={handleReminderUpdate}
            />
        </View>
    );
};

export default TaskEditBottomSheetDemo;
