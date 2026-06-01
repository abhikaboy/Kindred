import React from "react";
import { router } from "expo-router";
import NotificationCard from "./NotificationCard";

type Props = {
    name: string;
    username?: string;
    userId: string;
    icon: string;
    time: number;
    message: string;
    referenceId?: string;
    thumbnail?: string;
};

const UserInfoFriendNotification = ({ name, userId, icon, time, message, thumbnail }: Props) => {
    const navigateToProfile = () => router.push(`/account/${userId}` as never);
    // The legacy server payload prefixes the message with the actor name; strip it
    // so we don't render "Sarah Sarah accepted your friend request."
    const trailing = message.startsWith(`${name} `) ? message.slice(name.length + 1) : message;

    return (
        <NotificationCard
            actorName={name}
            actorIcon={icon}
            actorId={userId}
            headlineTrailing={trailing}
            timestamp={time}
            thumbnailUrl={thumbnail}
            ctaLabel="View profile"
            onCtaPress={navigateToProfile}
        />
    );
};

export default UserInfoFriendNotification;
