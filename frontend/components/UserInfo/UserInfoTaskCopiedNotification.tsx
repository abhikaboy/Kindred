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
    /** The copied task's id — body tap deep-links to it. */
    referenceId: string;
};

const UserInfoTaskCopiedNotification = ({ name, userId, content, icon, time, referenceId }: Props) => {
    const ThemedColor = useThemeColor();
    const message = content.startsWith(`${name} `) ? content.slice(name.length + 1) : content;

    return (
        <SpeechBubbleCard
            sender={{ name, picture: icon, id: userId }}
            header={
                <ThemedText type="defaultSemiBold" style={{ color: ThemedColor.text, fontSize: 15 }}>
                    Task copied 💪
                </ThemedText>
            }
            message={message}
            timeLabel={getNotificationTimeLabel(time)}
            read
            onPress={() => router.push(`/(logged-in)/(tabs)/(task)/task/${referenceId}`)}
            onAvatarPress={() => router.push(`/account/${userId}`)}
            visible
        />
    );
};

export default UserInfoTaskCopiedNotification;
