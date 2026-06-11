import React from "react";
import { router } from "expo-router";
import { ThemedText } from "../ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import SpeechBubbleCard from "@/components/cards/SpeechBubbleCard";
import { getNotificationTimeLabel } from "./notificationTime";

type Props = {
    name: string;
    userId: string;
    /** Backend copy: `reacted ❤️ to your encouragement: "msg"` */
    content: string;
    icon: string;
    time: number;
};

const UserInfoKudosReactionNotification = ({ name, userId, content, icon, time }: Props) => {
    const ThemedColor = useThemeColor();

    return (
        <SpeechBubbleCard
            sender={{ name, picture: icon, id: userId }}
            header={
                <ThemedText type="defaultSemiBold" style={{ color: ThemedColor.text, fontSize: 15 }}>
                    Your kudos landed
                </ThemedText>
            }
            message={content}
            timeLabel={getNotificationTimeLabel(time)}
            read
            onPress={() => router.push(`/account/${userId}`)}
            onAvatarPress={() => router.push(`/account/${userId}`)}
            visible
        />
    );
};

export default UserInfoKudosReactionNotification;
