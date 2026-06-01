import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { ThemedText } from "../ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import PreviewIcon from "../profile/PreviewIcon";
import { getNotificationTimeLabel } from "./notificationTime";

type Props = {
    name: string;
    userId: string;
    content: string;
    icon: string;
    time: number;
};

const UserInfoRingsClosedNotification = ({ name, userId, content, icon, time }: Props) => {
    const ThemedColor = useThemeColor();
    const timeLabel = getNotificationTimeLabel(time);

    const handlePress = () => {
        router.push(`/account/${userId}` as never);
    };

    return (
        <TouchableOpacity style={styles.container} onPress={handlePress} activeOpacity={0.7}>
            <TouchableOpacity onPress={handlePress} activeOpacity={0.7}>
                <PreviewIcon size="smallMedium" icon={icon} />
            </TouchableOpacity>

            <View style={styles.textContainer}>
                <ThemedText type="smallerDefault" style={styles.text}>
                    <ThemedText type="smallerDefault" style={{ fontWeight: "500" }}>
                        {name}
                    </ThemedText>
                    <ThemedText type="smallerDefault">
                        {" "}
                        {content.startsWith(`${name} `) ? content.slice(name.length + 1) : content}
                    </ThemedText>
                </ThemedText>
                <ThemedText type="caption">{timeLabel}</ThemedText>
            </View>

            <TouchableOpacity
                onPress={(e) => {
                    e.stopPropagation();
                    handlePress();
                }}
                style={[styles.ctaButton, { borderColor: ThemedColor.primary }]}
                accessibilityRole="button"
                accessibilityLabel={`Send congrats to ${name}`}>
                <ThemedText type="defaultSemiBold" style={{ color: ThemedColor.primary, fontSize: 13 }}>
                    Send congrats
                </ThemedText>
            </TouchableOpacity>
        </TouchableOpacity>
    );
};

export default UserInfoRingsClosedNotification;

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        width: "100%",
        gap: 12,
        alignItems: "center",
    },
    textContainer: {
        flex: 1,
        flexShrink: 1,
    },
    text: {
        flexWrap: "wrap",
    },
    ctaButton: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 10,
        borderWidth: 1,
    },
});
