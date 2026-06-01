import React from "react";
import { StyleSheet, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { ThemedText } from "../ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import KudosItem from "@/components/cards/KudosItem";
import { getNotificationTimeLabel } from "./notificationTime";

type Props = {
    name: string;
    userId: string;
    taskName: string;
    message?: string;
    icon: string;
    time: number;
    // For encouragements this is the task ID; for congratulations this is the post ID.
    // Empty string if the notification has no entity to deep-link to (e.g. profile-scope encouragement).
    referenceId: string;
    type?: "encouragement" | "congratulation";
};

const UserInfoEncouragementNotification = ({
    name,
    userId,
    taskName,
    message,
    icon,
    time,
    type = "encouragement",
}: Props) => {
    const ThemedColor = useThemeColor();
    const isCongrats = type === "congratulation";

    // Reply to a kudos by opening the sender's profile — from there the user
    // can send a kudos back, encourage them on their own tasks, or react in
    // any other context-appropriate way.
    const handlePress = () => {
        router.push(`/account/${userId}` as never);
    };

    // Adapt the notification shape to the KudosData contract that KudosItem
    // already knows how to render. The notification payload doesn't carry a
    // categoryName, so we surface the kudos kind there instead.
    const kudos = {
        id: `${type}-${time}`,
        sender: { name, picture: icon, id: userId },
        message: message || (isCongrats ? "Congratulated you!" : "Sent you an encouragement"),
        scope: "task",
        categoryName: isCongrats ? "Congratulations" : "Encouragement",
        taskName,
        timestamp: new Date(time).toISOString(),
        read: true,
        type: "message",
    };

    return (
        <KudosItem
            kudos={kudos}
            formatTime={(iso) => getNotificationTimeLabel(new Date(iso).getTime())}
            visible
            footerSlot={
                <TouchableOpacity
                    onPress={handlePress}
                    activeOpacity={0.8}
                    style={[styles.ctaButton, { borderColor: ThemedColor.primary }]}
                    accessibilityRole="button"
                    accessibilityLabel={`View ${name}'s profile`}>
                    <ThemedText type="defaultSemiBold" style={{ color: ThemedColor.primary, fontSize: 14 }}>
                        View profile
                    </ThemedText>
                </TouchableOpacity>
            }
        />
    );
};

export default UserInfoEncouragementNotification;

const styles = StyleSheet.create({
    ctaButton: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 10,
        borderWidth: 1,
    },
});
