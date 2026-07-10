import React from "react";
import { router } from "expo-router";
import NotificationCard, { SentenceBold, SentenceFocus, SentenceText } from "@/components/notifications/NotificationCard";

type Props = {
    name: string;
    userId: string;
    comment: string;
    icon: string;
    time: number;
    image?: string;
    referenceId: string;
};

// Backend sends content pre-composed ('<name> commented: "text"') — keep only the comment body.
const extractCommentBody = (raw: string) => {
    const match = raw.match(/commented:\s*"?([\s\S]*?)"?\s*$/i);
    return (match ? match[1] : raw).trim();
};

const UserInfoCommentNotification = ({ name, userId, comment, icon, time, referenceId }: Props) => {
    const commentBody = comment ? extractCommentBody(comment) : "";

    // The comment flows inline with the sentence, Venmo-style.
    const sentence = (
        <SentenceText>
            <SentenceBold>{name}</SentenceBold>
            {" commented on your post"}
            {commentBody ? ": " : ""}
            {commentBody ? <SentenceFocus>{`"${commentBody}"`}</SentenceFocus> : null}
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

export default UserInfoCommentNotification;
