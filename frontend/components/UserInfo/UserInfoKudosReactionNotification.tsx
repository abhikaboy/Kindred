import React from "react";
import { router } from "expo-router";
import NotificationCard, { SentenceBold, SentenceText } from "@/components/notifications/NotificationCard";

type Props = {
    name: string;
    userId: string;
    /** Backend phrase incl. the emoji, e.g. 'reacted 🎉 to your encouragement'. */
    content?: string;
    icon: string;
    time: number;
};

const UserInfoKudosReactionNotification = ({ name, userId, content, icon, time }: Props) => {
    const tail = content?.startsWith("reacted") ? content : "reacted to your kudos";
    const sentence = (
        <SentenceText>
            <SentenceBold>{name}</SentenceBold>
            {` ${tail}`}
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

export default UserInfoKudosReactionNotification;
