import React from "react";
import { router } from "expo-router";
import NotificationCard, { SentenceBold, SentenceText } from "@/components/notifications/NotificationCard";

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
    const taskName = content.match(/"([^"]+)"/)?.[1];

    const sentence = (
        <SentenceText>
            <SentenceBold>{name}</SentenceBold>
            {" added "}
            {taskName ? <SentenceBold>{taskName}</SentenceBold> : null}
            {taskName ? " from your blueprint 💪" : "a task from your blueprint 💪"}
        </SentenceText>
    );

    return (
        <NotificationCard
            time={time}
            icon={icon}
            userId={userId}
            sentence={sentence}
            onPress={() => router.push(`/(logged-in)/(tabs)/(task)/task/${referenceId}`)}
        />
    );
};

export default UserInfoTaskCopiedNotification;
