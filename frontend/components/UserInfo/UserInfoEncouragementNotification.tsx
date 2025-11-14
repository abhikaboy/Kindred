import React, { useEffect } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { ThemedText } from "../ThemedText";
import PreviewIcon from "../profile/PreviewIcon";
import { router } from "expo-router";
import { Sparkle } from "phosphor-react-native";
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, Easing } from "react-native-reanimated";
import { useThemeColor } from "@/hooks/useThemeColor";

type Props = {
    name: string;
    userId: string;
    taskName: string;
    icon: string;
    time: number;
    referenceId: string; // Post ID to navigate to
    type?: "encouragement" | "congratulation"; // Type of notification
};

const UserInfoEncouragementNotification = ({ name, userId, taskName, icon, time, referenceId, type = "encouragement" }: Props) => {
    const ThemedColor = useThemeColor();
    
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
        // Navigate to the post that was encouraged
        router.push(`/post/${referenceId}`);
    };

    // Animation for sparkle icon
    const scale = useSharedValue(1);
    const rotation = useSharedValue(0);

    useEffect(() => {
        // Subtle pulse and rotation animation
        scale.value = withRepeat(
            withSequence(
                withTiming(1.15, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
                withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) })
            ),
            -1,
            false
        );

        rotation.value = withRepeat(
            withSequence(
                withTiming(5, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
                withTiming(-5, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
                withTiming(0, { duration: 1000, easing: Easing.inOut(Easing.ease) })
            ),
            -1,
            false
        );
    }, []);

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [
                { scale: scale.value },
                { rotate: `${rotation.value}deg` as any },
            ],
        } as any;
    });

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
                            <ThemedText type="smallerDefault">
                                {type === "congratulation" 
                                    ? ` congratulated you on completing ${taskName}` 
                                    : ` sent you an encouragement for ${taskName}`}
                            </ThemedText>
                        </ThemedText>
                        <ThemedText type="caption">
                            {timeLabel}
                        </ThemedText>
                    </View>
                </ThemedText>
            </View>

            <Animated.View style={[styles.iconContainer, animatedStyle] as any}>
                <Sparkle size={36} color={ThemedColor.primary} weight="fill" />
            </Animated.View>
        </TouchableOpacity>
    );
};

export default UserInfoEncouragementNotification;

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        width: "100%",
        gap: 12,
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
        width: 36,
        height: 36,
        justifyContent: "center",
        alignItems: "center",
        marginLeft: "auto",
    },
});
