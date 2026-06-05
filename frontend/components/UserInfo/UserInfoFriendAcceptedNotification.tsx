import React from "react";
import { router } from "expo-router";
import { ThemedText } from "../ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import SpeechBubbleCard from "@/components/cards/SpeechBubbleCard";
import { getNotificationTimeLabel } from "./notificationTime";

type Props = {
    name: string;
    userId: string;
    content: string;
    icon: string;
    time: number;
};

const UserInfoFriendAcceptedNotification = ({ name, userId, content, icon, time }: Props) => {
    const ThemedColor = useThemeColor();
    const message = content.startsWith(`${name} `) ? content.slice(name.length + 1) : content;

    return (
        <SpeechBubbleCard
            sender={{ name, picture: icon, id: userId }}
            header={
                <ThemedText type="defaultSemiBold" style={{ color: ThemedColor.text, fontSize: 15 }}>
                    Friends now
                </ThemedText>
            }
            message={message}
            timeLabel={getNotificationTimeLabel(time)}
            read
            onPress={() => router.push(`/account/${userId}`)}
            onAvatarPress={() => router.push(`/account/${userId}`)}
            visible
        />
    );
};

export default UserInfoFriendAcceptedNotification;
