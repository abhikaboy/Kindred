import React from "react";
import { router } from "expo-router";
import NotificationCard from "./NotificationCard";

type Props = {
    name: string;
    userId: string;
    taskName: string;
    icon: string;
    time: number;
    // For encouragements this is the task ID; for congratulations this is the post ID.
    // Empty string if the notification has no entity to deep-link to (e.g. profile-scope encouragement).
    referenceId: string;
    type?: "encouragement" | "congratulation";
};

const UserInfoEncouragementNotification = ({ name, userId, taskName, icon, time, referenceId, type = "encouragement" }: Props) => {
    const isCongrats = type === "congratulation";

    const handlePress = () => {
        if (!referenceId) {
            const tab = isCongrats ? "congratulations" : "encouragements";
            router.push(`/(logged-in)/(tabs)/(task)/kudos?tab=${tab}` as never);
            return;
        }
        if (isCongrats) {
            router.push(`/(logged-in)/posting/${referenceId}` as never);
        } else {
            router.push(`/(logged-in)/(tabs)/(task)/task/${referenceId}` as never);
        }
    };

    return (
        <NotificationCard
            actorName={name}
            actorIcon={icon}
            actorId={userId}
            headlineTrailing={
                isCongrats
                    ? `congratulated you on completing ${taskName}`
                    : `sent you an encouragement for ${taskName}`
            }
            timestamp={time}
            ctaLabel={isCongrats ? "View post" : "View goal"}
            onCtaPress={handlePress}
        />
    );
};

export default UserInfoEncouragementNotification;
