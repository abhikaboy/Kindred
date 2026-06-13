import React from "react";
import { router } from "expo-router";
import SpeechBubbleCard from "@/components/cards/SpeechBubbleCard";
import NotificationBadgeIcon from "@/components/notifications/NotificationBadgeIcon";
import { getNotificationTimeLabel } from "./notificationTime";

type Props = {
    name: string;
    userId: string;
    comment: string;
    icon: string;
    time: number;
    /** Post thumbnail. Suppressed when it's just the actor avatar again. */
    image?: string;
    referenceId: string;
};

const UserInfoCommentNotification = ({ name, userId, comment, icon, time, image, referenceId }: Props) => {
    const showThumbnail = !!image && image !== icon;

    return (
        <SpeechBubbleCard
            sender={{ name, picture: icon, id: userId }}
            badge={<NotificationBadgeIcon type="comment" />}
            title="commented on your post"
            message={comment}
            thumbnailUri={showThumbnail ? image : undefined}
            timeLabel={getNotificationTimeLabel(time)}
            read
            onPress={() => router.push(`/posting/${referenceId}`)}
            onAvatarPress={() => router.push(`/account/${userId}`)}
            visible
        />
    );
};

export default UserInfoCommentNotification;
