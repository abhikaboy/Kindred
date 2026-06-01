import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
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
    referenceId,
    type = "encouragement",
}: Props) => {
    const ThemedColor = useThemeColor();
    const isCongrats = type === "congratulation";
    const ctaLabel = isCongrats ? "View post" : "View goal";

    const handlePress = () => {
        if (!referenceId) {
            const tab = isCongrats ? "congratulations" : "encouragements";
            router.push(`/(logged-in)/(tabs)/(task)/kudos?tab=${tab}` as never);
            return;
        }
        if (isCongrats) {
            router.push(`/(logged-in)/posting/${referenceId}` as never);
        } else {
            router.push(`/(logged-in)/(tabs)/(task)/task/${referenceId}` as never);
        }
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
        <View style={styles.container}>
            <KudosItem
                kudos={kudos}
                formatTime={(iso) => getNotificationTimeLabel(new Date(iso).getTime())}
                visible
            />
            <TouchableOpacity
                onPress={handlePress}
                activeOpacity={0.8}
                style={[styles.ctaButton, { borderColor: ThemedColor.primary }]}
                accessibilityRole="button"
                accessibilityLabel={ctaLabel}>
                <ThemedText type="defaultSemiBold" style={{ color: ThemedColor.primary, fontSize: 14 }}>
                    {ctaLabel}
                </ThemedText>
            </TouchableOpacity>
        </View>
    );
};

export default UserInfoEncouragementNotification;

const styles = StyleSheet.create({
    container: {
        gap: 12,
    },
    ctaButton: {
        alignSelf: "flex-end",
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 10,
        borderWidth: 1,
    },
});
