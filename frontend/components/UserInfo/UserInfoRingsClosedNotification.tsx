import React, { useState } from "react";
import { StyleSheet, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { ThemedText } from "../ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import SpeechBubbleCard from "@/components/cards/SpeechBubbleCard";
import CongratulateModal from "@/components/modals/CongratulateModal";
import { getNotificationTimeLabel } from "./notificationTime";

type Props = {
    notificationId: string;
    name: string;
    userId: string;
    handle?: string;
    content: string;
    icon: string;
    time: number;
};

const UserInfoRingsClosedNotification = ({
    notificationId,
    name,
    userId,
    handle,
    content,
    icon,
    time,
}: Props) => {
    const ThemedColor = useThemeColor();
    const [showCongrats, setShowCongrats] = useState(false);
    const message = content.startsWith(`${name} `) ? content.slice(name.length + 1) : content;

    return (
        <>
            <SpeechBubbleCard
                sender={{ name, picture: icon, id: userId }}
                header={
                    <ThemedText type="defaultSemiBold" style={{ color: ThemedColor.primary, fontSize: 15 }}>
                        🎉 Closed all rings
                    </ThemedText>
                }
                message={message}
                timeLabel={getNotificationTimeLabel(time)}
                read
                onPress={() => router.push(`/account/${userId}`)}
                onAvatarPress={() => router.push(`/account/${userId}`)}
                visible
                footerSlot={
                    <TouchableOpacity
                        onPress={() => setShowCongrats(true)}
                        style={[styles.ctaButton, { borderColor: ThemedColor.primary }]}
                        accessibilityRole="button"
                        accessibilityLabel={`Send congrats to ${name}`}>
                        <ThemedText type="defaultSemiBold" style={{ color: ThemedColor.primary, fontSize: 13 }}>
                            Send congrats
                        </ThemedText>
                    </TouchableOpacity>
                }
            />

            {showCongrats && (
                <CongratulateModal
                    visible={showCongrats}
                    setVisible={setShowCongrats}
                    task={{ id: notificationId, content: "Closed all rings", value: 0, priority: 0, categoryId: "" }}
                    congratulationConfig={{ userHandle: handle || name, receiverId: userId, categoryName: "Rings" }}
                />
            )}
        </>
    );
};

export default UserInfoRingsClosedNotification;

const styles = StyleSheet.create({
    ctaButton: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1 },
});
