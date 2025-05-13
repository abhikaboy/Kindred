import React from "react";
import { View, StyleSheet, TouchableOpacity, Image } from "react-native";
import { ThemedText } from "../ThemedText";
import PreviewIcon from "../profile/PreviewIcon";
import { getThemedColor } from "@/constants/Colors";

type Props = {
    name: string;
    userId: string;
    comment: string;
    icon: string;
    time: number;
    image: string;
};

const UserInfoEncouragementNotification = ({ name, userId, comment, icon, time, image }: Props) => {
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

    return (
        <View style={styles.container}>
            <TouchableOpacity onPress={() => console.log("Comment Notification")}>
                <PreviewIcon size={"smallMedium"} icon={icon} />
            </TouchableOpacity>

            <View style={styles.textContainer}>
                <ThemedText numberOfLines={0} ellipsizeMode="tail" type="default" style={styles.text}>
                    <ThemedText style={{ fontWeight: "600" }}>{name}</ThemedText>
                    <ThemedText> just commented "{comment}" on your recent post</ThemedText>
                </ThemedText>
                <ThemedText type="caption" style={styles.timeText}>
                {timeLabel}
                </ThemedText>
            </View>

            <View style={styles.iconContainer}>
                <Image source={{ uri: image }} style={{ width: 50, height: 50, borderRadius: 3 }} />
            </View>
        </View>
    );
};

export default UserInfoEncouragementNotification;

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
    timeText: {
        marginTop: 4,
        color: "#888",
    },
    iconContainer: {
        width: 50,
        height: 50,
        justifyContent: "center",
        alignItems: "center",
        marginLeft: "auto",
    },
});
