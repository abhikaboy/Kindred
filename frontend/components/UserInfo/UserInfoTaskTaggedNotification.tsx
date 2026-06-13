import React from "react";
import { router } from "expo-router";
import SpeechBubbleCard from "@/components/cards/SpeechBubbleCard";
import NotificationBadgeIcon from "@/components/notifications/NotificationBadgeIcon";
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
    const showThumbnail = !!image && image !== icon;

    return (
        <SpeechBubbleCard
            sender={{ name, picture: icon, id: userId }}
            badge={<NotificationBadgeIcon type="task_tagged" />}
            title="tagged you in a task"
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
