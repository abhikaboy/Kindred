import React from "react";
import { router } from "expo-router";
import SpeechBubbleCard from "@/components/cards/SpeechBubbleCard";
import NotificationBadgeIcon from "@/components/notifications/NotificationBadgeIcon";
import { getNotificationTimeLabel } from "./notificationTime";

type Props = {
    name: string;
    userId: string;
    /** Kept for caller compatibility; the title says it all, so it isn't rendered. */
    content?: string;
    icon: string;
    time: number;
};

const UserInfoFriendAcceptedNotification = ({ name, userId, icon, time }: Props) => {
    return (
        <SpeechBubbleCard
            sender={{ name, picture: icon, id: userId }}
            badge={<NotificationBadgeIcon type="friend_request_accepted" />}
            title="accepted your friend request"
            timeLabel={getNotificationTimeLabel(time)}
            read
            onPress={() => router.push(`/account/${userId}`)}
            onAvatarPress={() => router.push(`/account/${userId}`)}
            visible
        />
    );
};

export default UserInfoFriendAcceptedNotification;
