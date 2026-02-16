import { Dimensions, StyleSheet, View, ScrollView, TouchableOpacity, ActivityIndicator, Animated } from "react-native";
import React, { useState, useEffect, useRef } from "react";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useThemeColor } from "@/hooks/useThemeColor";
import UserInfoCommentNotification from "@/components/UserInfo/UserInfoCommentNotification";
import UserInfoEncouragementNotification from "@/components/UserInfo/UserInfoEncouragementNotification";
import UserInfoFriendNotification from "@/components/UserInfo/UserInfoFriendNotification";
import { Icons } from "@/constants/Icons";
import { router } from "expo-router";
import { useNotifications } from "@/hooks/useNotifications";
import type { NotificationDocument } from "@/api/types";
import { FollowRequestsSection } from "@/components/profile/FollowRequestsSection";
import { useFocusEffect } from "@react-navigation/native";

const ONE_DAY = 24 * 60 * 60 * 1000;
const ONE_WEEK = 7 * ONE_DAY;
const ONE_MONTH = 30 * ONE_DAY;

type ProcessedNotification = {
    id: string;
    type: "comment" | "encouragement" | "congratulation" | "friend_request" | "friend_request_accepted";
    name: string;
    userId: string;
    time: number;
    icon: string;
    content: string;
    taskName?: string;
    image?: string;
    read: boolean;
    referenceId: string; // Post ID or Task ID that the notification references
    thumbnail?: string; // Optional thumbnail for friend notifications
};

// Skeleton Component
const NotificationsSkeleton = ({ ThemedColor }: { ThemedColor: any }) => {
    const shimmerAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(shimmerAnim, {
                    toValue: 1,
                    duration: 1500,
                    useNativeDriver: true,
                }),
                Animated.timing(shimmerAnim, {
                    toValue: 0,
                    duration: 1500,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, [shimmerAnim]);

    const opacity = shimmerAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0.3, 0.7],
    });

    const SkeletonItem = () => (
        <View style={skeletonStyles.itemContainer}>
            <Animated.View
                style={[
                    skeletonStyles.avatar,
                    {
                        backgroundColor: ThemedColor.tertiary,
                        opacity,
                    },
                ]}
            />
            <View style={skeletonStyles.textContainer}>
                <Animated.View
                    style={[
                        skeletonStyles.nameLine,
                        {
                            backgroundColor: ThemedColor.tertiary,
                            opacity,
                        },
                    ]}
                />
                <Animated.View
                    style={[
                        skeletonStyles.contentLine,
                        {
                            backgroundColor: ThemedColor.tertiary,
                            opacity,
                        },
                    ]}
                />
                <Animated.View
                    style={[
                        skeletonStyles.timeLine,
                        {
                            backgroundColor: ThemedColor.tertiary,
                            opacity,
                        },
                    ]}
                />
            </View>
            <Animated.View
                style={[
                    skeletonStyles.thumbnail,
                    {
                        backgroundColor: ThemedColor.tertiary,
                        opacity,
                    },
                ]}
            />
        </View>
    );

    const SkeletonSection = ({ itemCount }: { itemCount: number }) => (
        <View style={skeletonStyles.section}>
            <Animated.View
                style={[
                    skeletonStyles.sectionTitle,
                    {
                        backgroundColor: ThemedColor.tertiary,
                        opacity,
                    },
                ]}
            />
            {Array.from({ length: itemCount }).map((_, index) => (
                <SkeletonItem key={index} />
            ))}
        </View>
    );

    return (
        <View>
            <SkeletonSection itemCount={3} />
            <SkeletonSection itemCount={2} />
            <SkeletonSection itemCount={2} />
        </View>
    );
};

// Extract NotificationItem component
const NotificationItem = ({
    notification,
    index,
    styles,
}: {
    notification: ProcessedNotification;
    index: number;
    styles: any;
}) => {
    return (
        <View key={`${notification.type}-${index}`} style={styles.listItem}>
            {notification.type === "comment" ? (
                <UserInfoCommentNotification
                    name={notification.name}
                    userId={notification.userId}
                    comment={notification.content}
                    icon={notification.icon}
                    time={notification.time}
                    image={notification.thumbnail || notification.image || Icons.coffee}
                    referenceId={notification.referenceId}
                />
            ) : notification.type === "encouragement" ? (
                <UserInfoEncouragementNotification
                    name={notification.name}
                    userId={notification.userId}
                    taskName={notification.taskName || "Task"}
                    icon={notification.icon}
                    time={notification.time}
                    referenceId={notification.referenceId}
                    type="encouragement"
                />
            ) : notification.type === "congratulation" ? (
                <UserInfoEncouragementNotification
                    name={notification.name}
                    userId={notification.userId}
                    taskName={notification.taskName || "Task"}
                    icon={notification.icon}
                    time={notification.time}
                    referenceId={notification.referenceId}
                    type="congratulation"
                />
            ) : notification.type === "friend_request" || notification.type === "friend_request_accepted" ? (
                <UserInfoFriendNotification
                    name={notification.name}
                    userId={notification.userId}
                    icon={notification.icon}
                    time={notification.time}
                    message={notification.content}
                    referenceId={notification.referenceId}
                    thumbnail={notification.thumbnail}
                />
            ) : null}
        </View>
    );
};

// Extract NotificationSection component
const NotificationSection = ({
    title,
    notifications,
    styles,
}: {
    title: string;
    notifications: ProcessedNotification[];
    styles: any;
}) => {
    if (notifications.length === 0) return null;

    return (
        <View style={styles.section}>
            <ThemedText type="defaultSemiBold">{title}</ThemedText>
            {notifications.map((notification, index) => (
                <NotificationItem
                    key={`${notification.type}-${notification.id}-${index}`}
                    notification={notification}
                    index={index}
                    styles={styles}
                />
            ))}
        </View>
    );
};

const Notifications = () => {
    const ThemedColor = useThemeColor();
    const styles = stylesheet(ThemedColor);
    const { notifications: rawNotifications, loading, error, refreshNotifications, markAllAsRead } = useNotifications();
    const hasMarkedAsRead = useRef(false);

    console.log("🔍 Raw notifications count:", rawNotifications.length);
    console.log("🔍 Loading:", loading);
    console.log("🔍 Error:", error);
    if (rawNotifications.length > 0) {
        console.log("🔍 First notification:", JSON.stringify(rawNotifications[0], null, 2));
    }

    // Mark all notifications as read when the page is focused (only once per mount)
    useFocusEffect(
        React.useCallback(() => {
            if (!loading && rawNotifications.length > 0 && !hasMarkedAsRead.current) {
                console.log("📖 Marking all notifications as read");
                hasMarkedAsRead.current = true;
                markAllAsRead();
            }

            // Reset the flag when the screen loses focus
            return () => {
                hasMarkedAsRead.current = false;
            };
        }, [])
    );

    const now = Date.now();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime();

    const isToday = (time: number) => time >= todayTimestamp;
    const isThisWeek = (time: number) => time >= now - ONE_WEEK && time < todayTimestamp;
    const isThisMonth = (time: number) => time >= now - ONE_MONTH && time < now - ONE_WEEK;
    const isOlder = (time: number) => time < now - ONE_MONTH;

    // Convert API notification to processed notification
    const processNotification = (notification: NotificationDocument): ProcessedNotification | null => {
        try {
            const notificationTime = new Date(notification.time).getTime();

            // Extract task name from content for encouragement/congratulation notifications
            let taskName = "";
            if (notification.notificationType === "ENCOURAGEMENT" || notification.notificationType === "CONGRATULATION") {
                const match = notification.content.match(/on (.+?):/);
                taskName = match ? match[1] : "Task";
            }

            return {
                id: notification.id,
                type: notification.notificationType.toLowerCase() as
                    | "comment"
                    | "encouragement"
                    | "congratulation"
                    | "friend_request"
                    | "friend_request_accepted",
                name: notification.user.display_name,
                userId: notification.user.id,
                time: notificationTime,
                icon: notification.user.profile_picture || Icons.coffee,
                content: notification.content,
                taskName: taskName || undefined,
                image: notification.user.profile_picture || Icons.coffee,
                read: notification.read,
                referenceId: notification.reference_id,
                thumbnail: notification.thumbnail,
            };
        } catch (error) {
            console.error("Error processing notification:", error, notification);
            return null;
        }
    };

    // Convert raw notifications to processed notifications
    const notifications = rawNotifications.map(processNotification).filter((n): n is ProcessedNotification => n !== null);

    console.log("🔍 Processed notifications count:", notifications.length);

    // Helper function to filter notifications by time period
    const filterByTimePeriod = (
        notifications: ProcessedNotification[],
        filterFn: (time: number) => boolean
    ): ProcessedNotification[] => {
        return notifications.filter((item) => filterFn(item.time));
    };

    // Organize notifications by time period
    const todayNotifications = filterByTimePeriod(notifications, isToday);
    const thisWeekNotifications = filterByTimePeriod(notifications, isThisWeek);
    const thisMonthNotifications = filterByTimePeriod(notifications, isThisMonth);
    const olderNotifications = filterByTimePeriod(notifications, isOlder);

    console.log("🔍 Today notifications:", todayNotifications.length);
    console.log("🔍 This week notifications:", thisWeekNotifications.length);
    console.log("🔍 This month notifications:", thisMonthNotifications.length);
    console.log("🔍 Older notifications:", olderNotifications.length);
    console.log("🔍 Today timestamp:", todayTimestamp);
    console.log("🔍 Now timestamp:", now);
    if (notifications.length > 0) {
        console.log("🔍 First notification time:", notifications[0].time, new Date(notifications[0].time).toISOString());
    }

    return (
        <ThemedView style={styles.container}>
            <View style={styles.headerContainer}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="chevron-back" size={24} color={ThemedColor.text} />
                </TouchableOpacity>
                <ThemedText type="subtitle">Notifications</ThemedText>
            </View>
            <ScrollView contentContainerStyle={styles.scrollViewContent}>
                <FollowRequestsSection styles={styles} maxVisible={4} />
                {loading ? (
                    <NotificationsSkeleton ThemedColor={ThemedColor} />
                ) : error ? (
                    <View style={styles.section}>
                        <ThemedText style={{ textAlign: "center", color: "red" }}>{error}</ThemedText>
                        <TouchableOpacity
                            onPress={() => refreshNotifications()}
                            style={{ marginTop: 16, alignItems: "center" }}>
                            <ThemedText style={{ color: ThemedColor.text }}>Tap to retry</ThemedText>
                        </TouchableOpacity>
                    </View>
                ) : notifications.length === 0 ? (
                    <View style={styles.section}>
                        <ThemedText style={{ textAlign: "center" }}>No notifications yet</ThemedText>
                    </View>
                ) : (
                    <>
                        <NotificationSection title="Today" notifications={todayNotifications} styles={styles} />
                        <NotificationSection title="This Week" notifications={thisWeekNotifications} styles={styles} />
                        <NotificationSection
                            title="This Month"
                            notifications={thisMonthNotifications}
                            styles={styles}
                        />
                        <NotificationSection title="Older" notifications={olderNotifications} styles={styles} />
                    </>
                )}
            </ScrollView>
        </ThemedView>
    );
};

const stylesheet = (ThemedColor: any) => {
    const PADDING_HORIZTONAL = Dimensions.get("window").width * 0.05;
    return StyleSheet.create({
        container: {
            flex: 1,
            paddingTop: Dimensions.get("window").height * 0.05,
        },
        headerContainer: {
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: PADDING_HORIZTONAL,
            paddingVertical: 32,
        },
        scrollViewContent: {
            paddingHorizontal: PADDING_HORIZTONAL,
        },
        section: {
            marginBottom: 16,
        },
        listItem: {
            marginVertical: 10,
        },
    });
};

// Skeleton Styles
const skeletonStyles = StyleSheet.create({
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        width: 80,
        height: 20,
        borderRadius: 4,
        marginBottom: 16,
    },
    itemContainer: {
        flexDirection: "row",
        alignItems: "center",
        marginVertical: 12,
        paddingHorizontal: 4,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        marginRight: 12,
    },
    textContainer: {
        flex: 1,
        gap: 8,
    },
    nameLine: {
        width: "40%",
        height: 14,
        borderRadius: 4,
    },
    contentLine: {
        width: "80%",
        height: 12,
        borderRadius: 4,
    },
    timeLine: {
        width: "25%",
        height: 10,
        borderRadius: 4,
    },
    thumbnail: {
        width: 60,
        height: 60,
        borderRadius: 8,
        marginLeft: 12,
    },
});

export default Notifications;
