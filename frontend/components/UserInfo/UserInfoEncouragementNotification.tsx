import React, { useState } from "react";
import { StyleSheet, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { ThemedText } from "../ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import KudosItem from "@/components/cards/KudosItem";
import EncourageModal from "@/components/modals/EncourageModal";
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
    const [encourageModalVisible, setEncourageModalVisible] = useState(false);

    // For encouragement: best reciprocal action is to send a kudos back to the
    // sender — works whether or not the original task is still active.
    // For congratulation: the celebration lives on a post; the natural action
    // is to open it so the recipient can react/reply in context.
    const ctaLabel = isCongrats ? "Open post" : "Send kudos back";

    const handlePress = () => {
        if (!isCongrats) {
            setEncourageModalVisible(true);
            return;
        }
        if (!referenceId) {
            router.push(`/(logged-in)/(tabs)/(task)/kudos?tab=congratulations` as never);
            return;
        }
        router.push(`/(logged-in)/posting/${referenceId}` as never);
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
        <>
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
                        accessibilityLabel={ctaLabel}>
                        <ThemedText type="defaultSemiBold" style={{ color: ThemedColor.primary, fontSize: 14 }}>
                            {ctaLabel}
                        </ThemedText>
                    </TouchableOpacity>
                }
            />
            {encourageModalVisible && (
                <EncourageModal
                    visible={encourageModalVisible}
                    setVisible={setEncourageModalVisible}
                    task={undefined}
                    encouragementConfig={{
                        userHandle: name,
                        receiverId: userId,
                        categoryName: "",
                    }}
                    isProfileLevel
                />
            )}
        </>
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
