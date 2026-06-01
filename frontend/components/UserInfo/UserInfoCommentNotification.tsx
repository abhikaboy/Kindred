import React from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { ThemedText } from "../ThemedText";
import PreviewIcon from "../profile/PreviewIcon";
import CachedImage from "../CachedImage";
import { getNotificationTimeLabel } from "./notificationTime";

type Props = {
    name: string;
    userId: string;
    comment: string;
    icon: string;
    time: number;
    /** Post thumbnail. Pass undefined when no real post image exists — do NOT fall back to the actor's avatar, that duplicates the row's leading avatar. */
    image?: string;
    referenceId: string;
};

const UserInfoCommentNotification = ({ name, userId, comment, icon, time, image, referenceId }: Props) => {
    const timeLabel = getNotificationTimeLabel(time);
    // Suppress the right-side thumbnail when it would just be the actor avatar again.
    const showThumbnail = !!image && image !== icon;

    const handleNotificationPress = () => {
        router.push(`/posting/${referenceId}` as never);
    };

    return (
        <TouchableOpacity style={styles.container} onPress={handleNotificationPress} activeOpacity={0.7}>
            <TouchableOpacity onPress={() => router.push(`/account/${userId}` as never)} activeOpacity={0.7}>
                <PreviewIcon size={"smallMedium"} icon={icon} />
            </TouchableOpacity>

            <View style={styles.textContainer}>
                <ThemedText numberOfLines={0} ellipsizeMode="tail" type="smallerDefault" style={styles.text}>
                    <ThemedText type="smallerDefault"> {comment} on your recent post</ThemedText>
                </ThemedText>
                <ThemedText type="caption">{timeLabel}</ThemedText>
            </View>

            {showThumbnail ? (
                <View style={styles.iconContainer}>
                    <CachedImage
                        source={{ uri: image! }}
                        style={{ width: 50, height: 50, borderRadius: 3 }}
                        variant="thumbnail"
                        cachePolicy="memory-disk"
                    />
                </View>
            ) : null}
        </TouchableOpacity>
    );
};

export default UserInfoCommentNotification;

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        width: "100%",
        gap: 12,
        alignItems: "flex-start",
    },
    textContainer: {
        flex: 1,
        flexShrink: 1,
        marginRight: 8,
    },
    text: {
        flexWrap: "wrap",
    },
    iconContainer: {
        width: 50,
        height: 50,
        justifyContent: "center",
        alignItems: "center",
        marginLeft: "auto",
    },
});
