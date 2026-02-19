import React, { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { View } from "react-native";
import { syncCalendarEvents } from "@/api/calendar";
import { useAlert } from "@/contexts/AlertContext";
import { useThemeColor } from "@/hooks/useThemeColor";
import { formatErrorForAlert, ERROR_MESSAGES } from "@/utils/errorParser";
import CalendarSetupBottomSheet from "@/components/modals/CalendarSetupBottomSheet";

export default function CalendarCallback() {
    const { action, connectionId, message } = useLocalSearchParams<{
        action: string;
        connectionId?: string;
        message?: string;
    }>();
    const router = useRouter();
    const { showAlert } = useAlert();
    const ThemedColor = useThemeColor();

    const [showSetup, setShowSetup] = useState(false);
    const [linkedConnectionId, setLinkedConnectionId] = useState<string | null>(null);

    useEffect(() => {
        if (action === "linked" && connectionId) {
            setLinkedConnectionId(connectionId);
            setShowSetup(true);
        } else if (action === "error") {
            const errorMessage = message || "Unable to connect your Google Calendar. Please try again.";
            showAlert({
                title: "Connection Failed",
                message: errorMessage,
                buttons: [
                    {
                        text: "OK",
                        style: "default",
                        onPress: () => router.replace("/(logged-in)/(tabs)/(task)"),
                    },
                ],
            });
        }
    }, [action, connectionId, message]);

    const handleSetupComplete = async () => {
        setShowSetup(false);
        try {
            const result = await syncCalendarEvents(linkedConnectionId!);
            const deletedText = result.tasks_deleted ? `\nDeleted: ${result.tasks_deleted}` : "";
            showAlert({
                title: "Calendar Linked!",
                message: `Successfully synced ${result.tasks_created} events.\n\nCreated: ${result.tasks_created}\nSkipped: ${result.tasks_skipped}${deletedText}\nTotal: ${result.events_total}`,
                buttons: [
                    {
                        text: "OK",
                        style: "default",
                        onPress: () => router.replace("/(logged-in)/(tabs)/(task)"),
                    },
                ],
            });
        } catch (error) {
            console.error("Error syncing calendar:", error);
            const errorInfo = formatErrorForAlert(error, ERROR_MESSAGES.CALENDAR_SYNC_FAILED);
            showAlert({
                title: "Calendar Linked",
                message: `Your calendar was linked successfully, but we couldn't sync events automatically.\n\n${errorInfo.message}\n\nYou can sync manually from the home page.`,
                buttons: [
                    {
                        text: "OK",
                        style: "default",
                        onPress: () => router.replace("/(logged-in)/(tabs)/(task)"),
                    },
                ],
            });
        }
    };

    const handleSetupCancel = () => {
        setShowSetup(false);
        router.replace("/(logged-in)/(tabs)/(task)");
    };

    return (
        <View style={{ flex: 1, backgroundColor: ThemedColor.background }}>
            {linkedConnectionId && (
                <CalendarSetupBottomSheet
                    visible={showSetup}
                    setVisible={setShowSetup}
                    connectionId={linkedConnectionId}
                    onComplete={handleSetupComplete}
                    onCancel={handleSetupCancel}
                />
            )}
        </View>
    );
}
