import React from "react";
import { router } from "expo-router";
import NotificationCard, { SentenceBold, SentenceText } from "@/components/notifications/NotificationCard";

type Props = {
    name: string;
    userId: string;
    icon: string;
    time: number;
    /** Post thumbnail. Suppressed when it's just the actor avatar again. */
    image?: string;
    referenceId: string;
};

const UserInfoPostTagNotification = ({ name, userId, icon, time, referenceId }: Props) => {
    const sentence = (
        <SentenceText>
            <SentenceBold>{name}</SentenceBold>
            {" tagged you in a post"}
        </SentenceText>
    );

    return (
        <NotificationCard
            time={time}
            icon={icon}
            userId={userId}
            sentence={sentence}
            onPress={() => router.push(`/posting/${referenceId}`)}
        />
    );
};

export default UserInfoPostTagNotification;
