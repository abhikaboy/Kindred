import React from "react";
import { router } from "expo-router";
import SpeechBubbleCard from "@/components/cards/SpeechBubbleCard";
import NotificationBadgeIcon from "@/components/notifications/NotificationBadgeIcon";
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
    // The title carries the verb; surface only the quoted task name as the body.
    const taskName = content.match(/"([^"]+)"/)?.[1];

    return (
        <SpeechBubbleCard
            sender={{ name, picture: icon, id: userId }}
            badge={<NotificationBadgeIcon type="task_copied" />}
            title="copied your task 💪"
            message={taskName ? `"${taskName}"` : undefined}
            timeLabel={getNotificationTimeLabel(time)}
            read
            onPress={() => router.push(`/(logged-in)/(tabs)/(task)/task/${referenceId}`)}
            onAvatarPress={() => router.push(`/account/${userId}`)}
            visible
        />
    );
};

export default UserInfoTaskCopiedNotification;
