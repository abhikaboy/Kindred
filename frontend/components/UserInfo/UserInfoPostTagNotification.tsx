import React from "react";
import { router } from "expo-router";
import { ThemedText } from "../ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import SpeechBubbleCard from "@/components/cards/SpeechBubbleCard";
import { getNotificationTimeLabel } from "./notificationTime";

type Props = {
    name: string;
    userId: string;
    icon: string;
    time: number;
    /** Post thumbnail. Suppressed when it's just the actor avatar again. */
    image?: string;
    referenceId: string;
};

const UserInfoPostTagNotification = ({ name, userId, icon, time, image, referenceId }: Props) => {
    const ThemedColor = useThemeColor();
    const showThumbnail = !!image && image !== icon;

    return (
        <SpeechBubbleCard
            sender={{ name, picture: icon, id: userId }}
            header={
                <ThemedText type="defaultSemiBold" style={{ color: ThemedColor.text, fontSize: 15 }}>
                    tagged you in a post
                </ThemedText>
            }
            thumbnailUri={showThumbnail ? image : undefined}
            timeLabel={getNotificationTimeLabel(time)}
            read
            onPress={() => router.push(`/posting/${referenceId}`)}
            onAvatarPress={() => router.push(`/account/${userId}`)}
            visible
        />
    );
};

export default UserInfoPostTagNotification;
