import React from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { ThemedText } from "../ThemedText";
import PreviewIcon from "../profile/PreviewIcon";
import CachedImage from "../CachedImage";
import { router } from "expo-router";
import { Icons } from "@/constants/Icons";
import { getNotificationTimeLabel } from "./notificationTime";

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

const UserInfoFriendNotification = ({ name, userId, icon, time, message, thumbnail }: Props) => {
    const timeLabel = getNotificationTimeLabel(time);

    const handleNotificationPress = () => {
        router.push(`/account/${userId}` as never);
    };

    return (
        <TouchableOpacity style={styles.container} onPress={handleNotificationPress} activeOpacity={0.7}>
            <TouchableOpacity onPress={() => router.push(`/account/${userId}` as never)} activeOpacity={0.7}>
                <PreviewIcon size={"smallMedium"} icon={icon} />
            </TouchableOpacity>

            <View style={styles.textContainer}>
                <ThemedText numberOfLines={0} ellipsizeMode="tail" type="smallerDefault" style={styles.text}>
                    <View>
                        <ThemedText>
                            <ThemedText type="smallerDefault" style={{ fontWeight: "500" }}>
                                {name}
                            </ThemedText>
                            <ThemedText type="smallerDefault"> {message.replace(`${name} `, "")}</ThemedText>
                        </ThemedText>
                        <ThemedText type="caption">{timeLabel}</ThemedText>
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
