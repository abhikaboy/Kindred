import React from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { ThemedText } from "../ThemedText";
import PreviewIcon from "../profile/PreviewIcon";
import CachedImage from "../CachedImage";
import { router } from "expo-router";
import { Icons } from "@/constants/Icons";

type Props = {
    name: string;
    username?: string;
    userId: string;
    icon: string;
    time: number;
    message: string;
    referenceId?: string;
    thumbnail?: string;
};

const UserInfoFriendNotification = ({ name, username, userId, icon, time, message, referenceId, thumbnail }: Props) => {
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
        // Navigate to the user's profile
        router.push(`/account/${userId}`);
    };

    return (
        <TouchableOpacity style={styles.container} onPress={handleNotificationPress} activeOpacity={0.7}>
            <TouchableOpacity onPress={() => router.push(`/account/${userId}`)} activeOpacity={0.7}>
                <PreviewIcon size={"smallMedium"} icon={icon} />
            </TouchableOpacity>

            <View style={styles.textContainer}>
                <ThemedText numberOfLines={0} ellipsizeMode="tail" type="smallerDefault" style={styles.text}>
                    <View>
                        <ThemedText>
                            <ThemedText type="smallerDefault" style={{ fontWeight: "500" }}>{name}</ThemedText>
                            <ThemedText type="smallerDefault"> {message.replace(`${name} `, "")}</ThemedText>
                        </ThemedText>
                        <ThemedText type="caption">
                            {timeLabel}
                        </ThemedText>
                    </View>
                </ThemedText>
            </View>

            <View style={styles.iconContainer}>
                <CachedImage 
                    source={{ uri: thumbnail || icon || Icons.coffee }} 
                    style={{ width: 50, height: 50, borderRadius: 25 }} 
                    variant="thumbnail" 
                    cachePolicy="memory-disk" 
                />
            </View>
        </TouchableOpacity>
    );
};

export default UserInfoFriendNotification;

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
        flexDirection: "row",
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
