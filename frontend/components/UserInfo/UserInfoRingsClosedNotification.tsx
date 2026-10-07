import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { CheckCircle, HandsClapping } from "phosphor-react-native";
import { ThemedText } from "../ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import CongratulateModal from "@/components/modals/CongratulateModal";
import NotificationCard, {
    ActionCircle,
    FooterRow,
    SentenceBold,
    SentenceText,
} from "@/components/notifications/NotificationCard";

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

    const sentence = (
        <SentenceText>
            <SentenceBold>{name}</SentenceBold>
            {" closed all their rings 🎉"}
        </SentenceText>
    );

    const footer = congratsSent ? (
        <View style={styles.sentRow}>
            <CheckCircle size={16} color={ThemedColor.primary} weight="fill" />
            <ThemedText type="defaultSemiBold" style={{ color: ThemedColor.primary, fontSize: 13 }}>
                Congrats sent
            </ThemedText>
        </View>
    ) : (
        <FooterRow>
            <ActionCircle
                label={`Send congrats to ${name}`}
                caption="Send congrats"
                onPress={() => setShowCongrats(true)}>
                <HandsClapping size={20} color={ThemedColor.text} />
            </ActionCircle>
        </FooterRow>
    );

    return (
        <>
            <NotificationCard
                time={time}
                icon={icon}
                userId={userId}
                sentence={sentence}
                footer={footer}
                onPress={() => router.push(`/account/${userId}`)}
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
    sentRow: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" },
});
