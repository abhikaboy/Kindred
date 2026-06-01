import React from "react";
import { router } from "expo-router";
import { ThemedText } from "../ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import NotificationCard from "./NotificationCard";

type Props = {
    name: string;
    userId: string;
    comment: string;
    icon: string;
    time: number;
    image: string;
    referenceId: string; // Post ID to navigate to
};

const UserInfoCommentNotification = ({ name, userId, comment, icon, time, image, referenceId }: Props) => {
    const ThemedColor = useThemeColor();
    const navigateToPost = () => router.push(`/posting/${referenceId}` as never);

    return (
        <NotificationCard
            actorName={name}
            actorIcon={icon}
            actorId={userId}
            headlineTrailing="commented on your post"
            timestamp={time}
            contentBlock={
                <ThemedText type="default" style={{ color: ThemedColor.text, fontSize: 14 }}>
                    “{comment}”
                </ThemedText>
            }
            thumbnailUrl={image}
            ctaLabel="Open discussion"
            onCtaPress={navigateToPost}
        />
    );
};

export default UserInfoCommentNotification;
