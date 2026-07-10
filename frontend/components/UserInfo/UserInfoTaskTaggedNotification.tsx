import React from "react";
import { router } from "expo-router";
import NotificationCard, { SentenceBold, SentenceText } from "@/components/notifications/NotificationCard";

type Props = {
    name: string;
    userId: string;
    icon: string;
    time: number;
    /** Task thumbnail. Suppressed when it's just the actor avatar again. */
    image?: string;
};

const UserInfoTaskTaggedNotification = ({ name, userId, icon, time }: Props) => {
    const sentence = (
        <SentenceText>
            <SentenceBold>{name}</SentenceBold>
            {" tagged you in a task"}
        </SentenceText>
    );

    return (
        <NotificationCard
            time={time}
            icon={icon}
            userId={userId}
            sentence={sentence}
            // Response banner lives on home
            onPress={() => router.push("/(logged-in)/(tabs)/(task)")}
        />
    );
};

export default UserInfoTaskTaggedNotification;
