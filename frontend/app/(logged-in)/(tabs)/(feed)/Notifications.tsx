import { Dimensions, StyleSheet, View, SectionList, TouchableOpacity, ActivityIndicator, Animated, InteractionManager, RefreshControl, ScrollView } from "react-native";
import React, { useState, useEffect, useRef, useCallback } from "react";
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
import { useFocusEffect } from "@react-navigation/native";
import { useAnalytics } from "@/hooks/useAnalytics";
import { AnalyticsEvents } from "@/utils/analytics";
import AnimatedTabs, { AnimatedTabContent } from "@/components/inputs/AnimatedTabs";
import ForYouTab from "@/components/forYou/ForYouTab";
import { useForYou } from "@/hooks/useForYou";
import RequestsTab from "@/components/requests/RequestsTab";

const ONE_DAY = 24 * 60 * 60 * 1000;
const ONE_WEEK = 7 * ONE_DAY;
const ONE_MONTH = 30 * ONE_DAY;

const NOTIFICATION_TABS = ["For You", "Activity", "Requests"];
const ACTIVITY_TAB_INDEX = 1;

type ProcessedNotification = {
    id: string;
    type: "comment" | "encouragement" | "congratulation" | "friend_request" | "friend_request_accepted";
    name: string;
    userId: string;
    time: number;
    icon: string;
    content: string;
    taskName?: string;
    /** For encouragement/congratulation notifications: the actual kudos message text (after the "on TaskName:" prefix in content). */
    kudosMessage?: string;
    image?: string;
    read: boolean;
    referenceId: string; // Post ID or Task ID that the notification references
    thumbnail?: string; // Optional thumbnail for friend notifications
};

type ActivityFilter = "all" | "encouragements" | "comments" | "social";

const FILTER_CHIPS: { id: ActivityFilter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "encouragements", label: "Encouragements" },
    { id: "comments", label: "Comments" },
    { id: "social", label: "Social" },
];

const filterByActivityType = (
    notifications: ProcessedNotification[],
    filter: ActivityFilter,
): ProcessedNotification[] => {
    switch (filter) {
        case "all":
            return notifications;
        case "encouragements":
            return notifications.filter((n) => n.type === "encouragement" || n.type === "congratulation");
        case "comments":
            return notifications.filter((n) => n.type === "comment");
        case "social":
            return notifications.filter((n) => n.type === "friend_request" || n.type === "friend_request_accepted");
    }
};

const NotificationFilterChips = ({
    active,
    onChange,
    ThemedColor,
}: {
    active: ActivityFilter;
    onChange: (id: ActivityFilter) => void;
    ThemedColor: any;
}) => {
    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={chipStyles.row}>
            {FILTER_CHIPS.map((chip) => {
                const isActive = active === chip.id;
                return (
                    <TouchableOpacity
                        key={chip.id}
                        onPress={() => onChange(chip.id)}
                        activeOpacity={0.7}
                        style={[
                            chipStyles.chip,
                            {
                                backgroundColor: isActive ? ThemedColor.primary : "transparent",
                                borderColor: isActive ? ThemedColor.primary : ThemedColor.tertiary,
                            },
                        ]}>
                        <ThemedText
                            style={[
                                chipStyles.chipText,
                                { color: isActive ? "#fff" : ThemedColor.text },
                            ]}>
                            {chip.label}
                        </ThemedText>
                    </TouchableOpacity>
                );
            })}
        </ScrollView>
    );
};

const TabPlaceholder = ({ label, ThemedColor }: { label: string; ThemedColor: any }) => (
    <View style={placeholderStyles.container}>
        <ThemedText style={{ color: ThemedColor.caption }}>{label}</ThemedText>
    </View>
);

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
    onNotificationPress,
}: {
    notification: ProcessedNotification;
    index: number;
    styles: any;
    onNotificationPress: (notification: ProcessedNotification) => void;
}) => {
    return (
        <TouchableOpacity key={`${notification.type}-${index}`} style={styles.listItem} onPress={() => onNotificationPress(notification)} activeOpacity={1}>
            {notification.type === "comment" ? (
                <UserInfoCommentNotification
                    name={notification.name}
                    userId={notification.userId}
                    comment={notification.content}
                    icon={notification.icon}
                    time={notification.time}
                    image={notification.thumbnail}
                    referenceId={notification.referenceId}
                />
            ) : notification.type === "encouragement" ? (
                <UserInfoEncouragementNotification
                    name={notification.name}
                    userId={notification.userId}
                    taskName={notification.taskName || "Task"}
                    message={notification.kudosMessage}
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
                    message={notification.kudosMessage}
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
        </TouchableOpacity>
    );
};

// Extract NotificationSection component
const NotificationSection = ({
    title,
    notifications,
    styles,
    onNotificationPress,
}: {
    title: string;
    notifications: ProcessedNotification[];
    styles: any;
    onNotificationPress: (notification: ProcessedNotification) => void;
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
                    onNotificationPress={onNotificationPress}
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
    const { capture } = useAnalytics();
    const [ready, setReady] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState(ACTIVITY_TAB_INDEX);
    const [activeChip, setActiveChip] = useState<ActivityFilter>("all");
    const { feed: forYouFeed, loading: forYouLoading, error: forYouError, refresh: refreshForYou, recordInteraction: recordForYouInteraction } = useForYou();
    const forYouUnreadCount = forYouFeed?.unreadCount ?? 0;
    const tabBadges = [activeTab !== 0 && forYouUnreadCount > 0, false, false];

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await refreshNotifications();
        setRefreshing(false);
    }, [refreshNotifications]);

    // Defer heavy rendering until the navigation transition completes
    useEffect(() => {
        const task = InteractionManager.runAfterInteractions(() => {
            setReady(true);
        });
        return () => task.cancel();
    }, []);

    const handleNotificationPress = (notification: ProcessedNotification) => {
        capture(AnalyticsEvents.NOTIFICATION_TAPPED, {
            notification_type: notification.type,
        });

        switch (notification.type) {
            case "encouragement":
                // referenceId is the task ID (task-scope) or empty (profile-scope).
                if (notification.referenceId) {
                    router.push(`/(logged-in)/(tabs)/(task)/task/${notification.referenceId}`);
                } else {
                    router.navigate("/(logged-in)/(tabs)/(task)/kudos?tab=encouragements");
                }
                break;
            case "congratulation":
                // referenceId is the post the congratulation is on.
                if (notification.referenceId) {
                    router.push(`/(logged-in)/posting/${notification.referenceId}`);
                } else {
                    router.navigate("/(logged-in)/(tabs)/(task)/kudos?tab=congratulations");
                }
                break;
            case "friend_request":
            case "friend_request_accepted":
                // Already on the notifications page which shows friend requests
                break;
            case "comment":
                if (notification.referenceId) {
                    router.push(`/(logged-in)/posting/${notification.referenceId}`);
                }
                break;
        }
    };

    // Mark all notifications as read when the page is focused. Runs at most once
    // per focus, only if there's something unread, and never re-fires on render
    // (markAllAsRead is intentionally not in the deps — its identity changed
    // every render in an earlier revision and triggered a request-spam loop).
    const hasUnread = rawNotifications.some((n) => !n.read);
    const markAllAsReadRef = useRef(markAllAsRead);
    markAllAsReadRef.current = markAllAsRead;
    useFocusEffect(
        React.useCallback(() => {
            if (!loading && hasUnread && !hasMarkedAsRead.current) {
                hasMarkedAsRead.current = true;
                markAllAsReadRef.current();
            }

            return () => {
                hasMarkedAsRead.current = false;
            };
        }, [loading, hasUnread])
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

            // Extract task name + kudos message from content for encouragement/congratulation.
            // Two backend content shapes:
            //   task scope    → `{name} on "{taskName}": "{message}"`
            //   profile scope → `{name} says: "{message}"`           (e.g. ring encouragements)
            let taskName = "";
            let kudosMessage: string | undefined;
            if (notification.notificationType === "ENCOURAGEMENT" || notification.notificationType === "CONGRATULATION") {
                const taskMatch = notification.content.match(/ on "?(.+?)"?:\s*"?(.*?)"?$/);
                const profileMatch = notification.content.match(/ says:\s*"?(.*?)"?$/);
                if (taskMatch) {
                    taskName = taskMatch[1];
                    kudosMessage = taskMatch[2]?.trim() || undefined;
                } else if (profileMatch) {
                    kudosMessage = profileMatch[1]?.trim() || undefined;
                    // taskName stays empty — UserInfoEncouragementNotification reads
                    // empty referenceId + empty taskName as profile-scope.
                }
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
                kudosMessage,
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
    const allNotifications = rawNotifications.map(processNotification).filter((n): n is ProcessedNotification => n !== null);
    const notifications = filterByActivityType(allNotifications, activeChip);

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

    const sections = [
        { title: "Today", data: todayNotifications },
        { title: "This Week", data: thisWeekNotifications },
        { title: "This Month", data: thisMonthNotifications },
        { title: "Older", data: olderNotifications },
    ].filter((s) => s.data.length > 0);

    // Activity tab no longer hosts FollowRequestsSection — friend requests
    // now live in their own Requests tab.
    const activityHeader = (
        <NotificationFilterChips active={activeChip} onChange={setActiveChip} ThemedColor={ThemedColor} />
    );

    const activityTabContent = !ready || loading ? (
        <View style={styles.scrollViewContent}>
            <NotificationsSkeleton ThemedColor={ThemedColor} />
        </View>
    ) : error ? (
        <View style={[styles.scrollViewContent, styles.section]}>
            <ThemedText style={{ textAlign: "center", color: "red" }}>{error}</ThemedText>
            <TouchableOpacity
                onPress={() => refreshNotifications()}
                style={{ marginTop: 16, alignItems: "center" }}>
                <ThemedText style={{ color: ThemedColor.text }}>Tap to retry</ThemedText>
            </TouchableOpacity>
        </View>
    ) : allNotifications.length === 0 ? (
        <View style={[styles.scrollViewContent, styles.section]}>
            <ThemedText style={{ textAlign: "center" }}>No notifications yet</ThemedText>
        </View>
    ) : (
        <SectionList
            sections={sections}
            keyExtractor={(item, index) => `${item.type}-${item.id}-${index}`}
            renderItem={({ item, index }) => (
                <NotificationItem
                    notification={item}
                    index={index}
                    styles={styles}
                    onNotificationPress={handleNotificationPress}
                />
            )}
            renderSectionHeader={({ section: { title, data } }) => {
                // Defensive: never render a bucket header above an empty bucket.
                // The `.filter((s) => s.data.length > 0)` above should make this
                // unreachable, but RN has occasionally rendered empty headers
                // during chip-filter transitions.
                if (!data || data.length === 0) return null;
                return (
                    <View style={styles.sectionHeader}>
                        <ThemedText type="defaultSemiBold">{title}</ThemedText>
                    </View>
                );
            }}
            ListHeaderComponent={activityHeader}
            ListEmptyComponent={
                <View style={styles.emptyFilterState}>
                    <ThemedText style={{ color: ThemedColor.caption, textAlign: "center" }}>
                        No notifications match this filter
                    </ThemedText>
                </View>
            }
            contentContainerStyle={styles.scrollViewContent}
            stickySectionHeadersEnabled={false}
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={5}
            refreshControl={
                <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    tintColor={ThemedColor.text}
                />
            }
        />
    );

    return (
        <ThemedView style={styles.container}>
            <View style={styles.headerContainer}>
                <TouchableOpacity onPress={() => router.back()} style={styles.headerSide}>
                    <Ionicons name="chevron-back" size={24} color={ThemedColor.text} />
                </TouchableOpacity>
                <ThemedText type="subtitle" style={styles.headerTitle}>Notifications</ThemedText>
                <TouchableOpacity
                    onPress={() => router.push("/(logged-in)/(tabs)/(profile)/settings")}
                    style={[styles.headerSide, styles.headerSideRight]}
                    accessibilityRole="button"
                    accessibilityLabel="Notification settings">
                    <Ionicons name="settings-outline" size={24} color={ThemedColor.text} />
                </TouchableOpacity>
            </View>
            <View style={styles.tabsWrapper}>
                <AnimatedTabs
                    tabs={NOTIFICATION_TABS}
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    badges={tabBadges}
                />
            </View>
            <AnimatedTabContent activeTab={activeTab} setActiveTab={setActiveTab} flex lazy>
                <ForYouTab
                    horizontalPadding={Dimensions.get("window").width * 0.05}
                    feed={forYouFeed}
                    loading={forYouLoading}
                    error={forYouError}
                    refresh={refreshForYou}
                    onInteraction={recordForYouInteraction}
                />
                <View style={{ flex: 1 }}>{activityTabContent}</View>
                <RequestsTab horizontalPadding={Dimensions.get("window").width * 0.05} />
            </AnimatedTabContent>
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
            paddingVertical: 20,
        },
        headerSide: {
            width: 32,
            justifyContent: "center",
        },
        headerSideRight: {
            alignItems: "flex-end",
        },
        headerTitle: {
            flex: 1,
            textAlign: "center",
        },
        tabsWrapper: {
            paddingHorizontal: PADDING_HORIZTONAL,
        },
        scrollViewContent: {
            paddingHorizontal: PADDING_HORIZTONAL,
            paddingTop: 16,
        },
        section: {
            marginBottom: 16,
        },
        listItem: {
            marginVertical: 14,
        },
        sectionHeader: {
            // Negative bottom margin counteracts the first list item's
            // marginVertical:14 so the header sits closer to its content
            // without changing the gap between subsequent items.
            marginBottom: -10,
            marginTop: 16,
        },
        emptyFilterState: {
            paddingVertical: 32,
        },
    });
};

const chipStyles = StyleSheet.create({
    row: {
        flexDirection: "row",
        gap: 8,
        paddingVertical: 4,
    },
    chip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 999,
        borderWidth: 1,
    },
    chipText: {
        fontSize: 14,
        fontFamily: "Outfit",
    },
});

const placeholderStyles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 24,
    },
});

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
