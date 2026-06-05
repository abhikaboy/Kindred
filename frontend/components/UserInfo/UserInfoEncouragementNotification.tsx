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
    // Task ID for encouragements / Post ID for congratulations. Empty string
    // for profile-scope kudos (e.g. ring encouragements) where there's no
    // task to deep-link to.
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
    referenceId,
    type = "encouragement",
}: Props) => {
    const ThemedColor = useThemeColor();
    const isCongrats = type === "congratulation";
    // Profile-scope (ring) encouragements arrive with no taskName and no
    // referenceId — KudosItem renders a "Profile Encouragement" header
    // instead of an empty category/task row when we pass scope: "profile".
    const isProfileScope = !referenceId && !taskName;

    const handlePress = () => {
        router.push(`/account/${userId}` as never);
    };

    const kudos = {
        id: `${type}-${time}`,
        sender: { name, picture: icon, id: userId },
        message: message || (isCongrats ? "Congratulated you!" : "Sent you an encouragement"),
        scope: isProfileScope ? "profile" : "task",
        categoryName: isProfileScope ? "" : isCongrats ? "Congratulations" : "Encouragement",
        taskName: isProfileScope ? "" : taskName,
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
                    accessibilityLabel={`Send kudos back to ${name}`}>
                    <ThemedText type="defaultSemiBold" style={{ color: ThemedColor.primary, fontSize: 13 }}>
                        Send kudos back
                    </ThemedText>
                </TouchableOpacity>
            }
        />
    );
};

export default UserInfoEncouragementNotification;

const styles = StyleSheet.create({
    ctaButton: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 10,
        borderWidth: 1,
    },
});
