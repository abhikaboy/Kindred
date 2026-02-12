import { useEffect } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { syncCalendarEvents } from "@/api/calendar";
import { useAlert } from "@/contexts/AlertContext";
import { useThemeColor } from "@/hooks/useThemeColor";
import { formatErrorForAlert, ERROR_MESSAGES } from "@/utils/errorParser";

export default function CalendarCallback() {
    const { action, connectionId, message } = useLocalSearchParams<{
        action: string;
        connectionId?: string;
        message?: string;
    }>();
    const router = useRouter();
    const { showAlert } = useAlert();
    const ThemedColor = useThemeColor();

    useEffect(() => {
        const handleCallback = async () => {
            if (action === "linked" && connectionId) {
                // Calendar was successfully linked, trigger auto-sync
                try {
                    const result = await syncCalendarEvents(connectionId);

                    const deletedText = result.tasks_deleted ? `\nDeleted: ${result.tasks_deleted}` : "";
                    showAlert({
                        title: "Calendar Linked!",
                        message: `Successfully synced ${result.tasks_created} events to "${result.workspace_name}" workspace.\n\nCreated: ${result.tasks_created}\nSkipped: ${result.tasks_skipped}${deletedText}\nTotal: ${result.events_total}`,
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
            } else if (action === "error") {
                // OAuth error occurred
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
        };

        handleCallback();
    }, [action, connectionId, message, showAlert, router]);

    return (
        <View
            style={{
                flex: 1,
                justifyContent: "center",
                alignItems: "center",
                backgroundColor: ThemedColor.background,
            }}>
            <ActivityIndicator size="large" color={ThemedColor.primary} />
            <ThemedText style={{ marginTop: 16 }}>Connecting your calendar...</ThemedText>
        </View>
    );
}
