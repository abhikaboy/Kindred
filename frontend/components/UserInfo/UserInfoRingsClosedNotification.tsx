import React, { useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { CheckCircle } from "phosphor-react-native";
import { ThemedText } from "../ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import SpeechBubbleCard from "@/components/cards/SpeechBubbleCard";
import NotificationBadgeIcon from "@/components/notifications/NotificationBadgeIcon";
import CongratulateModal from "@/components/modals/CongratulateModal";
import { getNotificationTimeLabel } from "./notificationTime";

type Props = {
    notificationId: string;
    name: string;
    userId: string;
    handle?: string;
    /** Kept for caller compatibility; the title says it all, so it isn't rendered. */
    content?: string;
    icon: string;
    time: number;
};

// The backend doesn't track which notifications were congratulated, so keep
// the sent state for the session — it survives SectionList window unmounts.
const sentCongratsIds = new Set<string>();

const UserInfoRingsClosedNotification = ({
    notificationId,
    name,
    userId,
    handle,
    icon,
    time,
}: Props) => {
    const ThemedColor = useThemeColor();
    const [showCongrats, setShowCongrats] = useState(false);
    const [congratsSent, setCongratsSent] = useState(sentCongratsIds.has(notificationId));

    const handleSent = () => {
        sentCongratsIds.add(notificationId);
        setCongratsSent(true);
    };

    return (
        <>
            <SpeechBubbleCard
                sender={{ name, picture: icon, id: userId }}
                badge={<NotificationBadgeIcon type="rings_closed" />}
                title="closed all their rings 🎉"
                timeLabel={getNotificationTimeLabel(time)}
                read
                onPress={() => router.push(`/account/${userId}`)}
                onAvatarPress={() => router.push(`/account/${userId}`)}
                visible
                footerSlot={
                    congratsSent ? (
                        <View style={styles.sentRow}>
                            <CheckCircle size={16} color={ThemedColor.primary} weight="fill" />
                            <ThemedText type="defaultSemiBold" style={{ color: ThemedColor.primary, fontSize: 13 }}>
                                Congrats sent
                            </ThemedText>
                        </View>
                    ) : (
                        <TouchableOpacity
                            onPress={() => setShowCongrats(true)}
                            style={[styles.ctaButton, { borderColor: ThemedColor.primary }]}
                            accessibilityRole="button"
                            accessibilityLabel={`Send congrats to ${name}`}>
                            <ThemedText type="defaultSemiBold" style={{ color: ThemedColor.primary, fontSize: 13 }}>
                                Send congrats
                            </ThemedText>
                        </TouchableOpacity>
                    )
                }
            />

            {showCongrats && (
                <CongratulateModal
                    visible={showCongrats}
                    setVisible={setShowCongrats}
                    task={{ id: notificationId, content: "Closed all rings", value: 0, priority: 0, categoryId: "" }}
                    congratulationConfig={{ userHandle: handle || name, receiverId: userId, categoryName: "Rings" }}
                    onSent={handleSent}
                />
            )}
        </>
    );
};

export default UserInfoRingsClosedNotification;

const styles = StyleSheet.create({
    // alignSelf keeps the chip hugging its label — the footer slot's flex
    // container otherwise stretches it across the full bubble width.
    ctaButton: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, alignSelf: "flex-start" },
    sentRow: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" },
});
