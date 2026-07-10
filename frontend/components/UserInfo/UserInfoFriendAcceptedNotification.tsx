import React from "react";
import { router } from "expo-router";
import NotificationCard, { SentenceBold, SentenceText } from "@/components/notifications/NotificationCard";

type Props = {
    name: string;
    userId: string;
    /** Kept for caller compatibility; the title says it all, so it isn't rendered. */
    content?: string;
    icon: string;
    time: number;
};

const UserInfoFriendAcceptedNotification = ({ name, userId, icon, time }: Props) => {
    const sentence = (
        <SentenceText>
            <SentenceBold>{name}</SentenceBold>
            {" accepted your friend request"}
        </SentenceText>
    );

    return (
        <NotificationCard
            time={time}
            icon={icon}
            userId={userId}
            sentence={sentence}
            onPress={() => router.push(`/account/${userId}`)}
        />
    );
};

export default UserInfoFriendAcceptedNotification;
