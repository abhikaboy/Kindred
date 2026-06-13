import React from "react";
import { router } from "expo-router";
import { ThemedText } from "../ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import SpeechBubbleCard from "@/components/cards/SpeechBubbleCard";
import { getNotificationTimeLabel } from "./notificationTime";

type Props = {
    name: string;
    userId: string;
    icon: string;
    time: number;
    /** Task thumbnail. Suppressed when it's just the actor avatar again. */
    image?: string;
};

const UserInfoTaskTaggedNotification = ({ name, userId, icon, time, image }: Props) => {
    const ThemedColor = useThemeColor();
    const showThumbnail = !!image && image !== icon;

    return (
        <SpeechBubbleCard
            sender={{ name, picture: icon, id: userId }}
            header={
                <ThemedText type="defaultSemiBold" style={{ color: ThemedColor.text, fontSize: 15 }}>
                    tagged you in a task
                </ThemedText>
            }
            thumbnailUri={showThumbnail ? image : undefined}
            timeLabel={getNotificationTimeLabel(time)}
            read
            // Response banner lives on home
            onPress={() => router.push("/(logged-in)/(tabs)/(task)")}
            onAvatarPress={() => router.push(`/account/${userId}`)}
            visible
        />
    );
};

export default UserInfoTaskTaggedNotification;
