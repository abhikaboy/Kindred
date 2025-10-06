import React from "react";
import { View, StyleSheet, TouchableOpacity, Image } from "react-native";
import { ThemedText } from "../ThemedText";
import PreviewIcon from "../profile/PreviewIcon";
import { getThemedColor } from "@/constants/Colors";
import { router } from "expo-router";
import CachedImage from "../CachedImage";

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
    const getTimeLabel = (timestamp: number) => {
        const currentTime = Date.now();
        const notificationDate = new Date(timestamp);
        const timeDifference = currentTime - timestamp;

        const diffMinutes = Math.floor(timeDifference / (1000 * 60));
        const diffHours = Math.floor(timeDifference / (1000 * 60 * 60));
        const diffDays = Math.floor(timeDifference / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            if (diffMinutes < 60) {
                return diffMinutes === 0 ? "Just now" : `${diffMinutes}m ago`;
            } else {
                return `${diffHours}h ago`;
            }
        }

        if (diffDays < 7) {
            return `${diffDays}d ago`;
        }

        const today = new Date();
        if (
            notificationDate.getMonth() === today.getMonth() &&
            notificationDate.getFullYear() === today.getFullYear()
        ) {
            return `${notificationDate.getDate()} ${getMonthName(notificationDate).substring(0, 3)}`;
        }

        return `${notificationDate.getDate()} ${getMonthName(notificationDate).substring(0, 3)} ${notificationDate.getFullYear()}`;
    };

    const getMonthName = (date: Date) => {
        const months = [
            "January",
            "February",
            "March",
            "April",
            "May",
            "June",
            "July",
            "August",
            "September",
            "October",
            "November",
            "December",
        ];
        return months[date.getMonth()];
    };

    const timeLabel = getTimeLabel(time);

    const handleNotificationPress = () => {
        // Navigate to the post that was commented on
        router.push(`/posting/${referenceId}`);
    };

    return (
        <TouchableOpacity style={styles.container} onPress={handleNotificationPress} activeOpacity={0.7}>
            <TouchableOpacity onPress={() => router.push(`/account/${userId}`)} activeOpacity={0.7}>
                <PreviewIcon size={"smallMedium"} icon={icon} />
            </TouchableOpacity>

            <View style={styles.textContainer}>
                <ThemedText numberOfLines={0} ellipsizeMode="tail" type="smallerDefault" style={styles.text}>
                    <ThemedText type="smallerDefaultSemiBold">{name}</ThemedText>
                    <ThemedText type="smallerDefault"> {comment} on your recent post</ThemedText>
                </ThemedText>
                <ThemedText type="caption">
                {timeLabel}
                </ThemedText>
            </View>

            <View style={styles.iconContainer}>
                <CachedImage source={{ uri: image }} style={{ width: 50, height: 50, borderRadius: 3 }} variant="thumbnail" cachePolicy="memory-disk" />
            </View>
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
