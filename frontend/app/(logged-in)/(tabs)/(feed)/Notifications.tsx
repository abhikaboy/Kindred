import { Dimensions, StyleSheet, View, ScrollView, TouchableOpacity } from "react-native";
import React, { useState, useEffect } from "react";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useThemeColor } from "@/hooks/useThemeColor";
import UserInfoFollowRequest from "@/components/UserInfo/UserInfoFollowRequest";
import UserInfoCommentNotification from "@/components/UserInfo/UserInfoCommentNotification";
import UserInfoEncouragementNotification from "@/components/UserInfo/UserInfoEncouragementNotification";
import { Icons } from "@/constants/Icons";
import { router } from "expo-router";
import { getConnectionsByReceiverAPI } from "@/api/connection";
import { showToast } from "@/utils/showToast";

const ONE_DAY = 24 * 60 * 60 * 1000;
const ONE_WEEK = 7 * ONE_DAY;
const ONE_MONTH = 30 * ONE_DAY;

type CommentNotificationProps = {
    name: string;
    userId: string;
    comment: string;
    icon: string;
    time: number;
    image: string;
};

type EncouragementNotificationProps = {
    name: string;
    userId: string;
    taskName: string;
    icon: string;
    time: number;
};

type FollowRequestProps = {
    name: string;
    username: string;
    icon: string;
    userId: string;
    connectionID: string;
};

type CombinedNotification =
    | (CommentNotificationProps & { type: "comment" })
    | (EncouragementNotificationProps & { type: "encouragement" });

// Extract NotificationItem component
const NotificationItem = ({
    notification,
    index,
    styles,
}: {
    notification: CombinedNotification;
    index: number;
    styles: any;
}) => {
    return (
        <View key={`${notification.type}-${index}`} style={styles.listItem}>
            {notification.type === "comment" ? (
                <UserInfoCommentNotification
                    name={notification.name}
                    userId={notification.userId}
                    comment={notification.comment}
                    icon={notification.icon}
                    time={notification.time}
                    image={notification.image}
                />
            ) : (
                <UserInfoEncouragementNotification
                    name={notification.name}
                    userId={notification.userId}
                    taskName={notification.taskName}
                    icon={notification.icon}
                    time={notification.time}
                />
            )}
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
    notifications: CombinedNotification[];
    styles: any;
}) => {
    if (notifications.length === 0) return null;

    return (
        <View style={styles.section}>
            <ThemedText type="subtitle">{title}</ThemedText>
            {notifications.map((notification, index) => (
                <NotificationItem
                    key={`${notification.type}-${index}`}
                    notification={notification}
                    index={index}
                    styles={styles}
                />
            ))}
        </View>
    );
};

// Extract FollowRequestsSection component
const FollowRequestsSection = ({ styles }: { styles: any }) => {
    const [requests, setRequests] = useState<FollowRequestProps[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchFollowRequests = async () => {
        try {
            setLoading(true);
            setError(null);
            
            const connections = await getConnectionsByReceiverAPI();
            
            // Transform API response to match FollowRequestProps interface
            const transformedRequests: FollowRequestProps[] = connections.map((connection) => ({
                name: connection.requester.name,
                username: connection.requester.handle,
                icon: connection.requester.picture || Icons.coffee, // fallback icon
                userId: connection.requester._id,
                connectionID: connection.id,
            }));
            
            setRequests(transformedRequests);
        } catch (err) {
            console.error('Failed to fetch follow requests:', err);
            setError('Failed to load follow requests');
            showToast('Failed to load follow requests', 'danger');
            setRequests([]); // Set empty array on error
        } finally {
            setLoading(false);
        }
    };

    const removeRequest = (connectionID: string) => {
        setRequests(prev => prev.filter(request => request.connectionID !== connectionID));
    };

    useEffect(() => {
        fetchFollowRequests();
    }, []);

    // Don't render anything while loading
    if (loading) return null;
    
    // Don't render if there's an error or no requests
    if (error || requests.length === 0) return null;

    return (
        <View style={styles.section}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <ThemedText type="subtitle">Friend Requests</ThemedText>
                {requests.length > 3 && (
                    <TouchableOpacity onPress={() => router.push("/FollowRequests")}>
                        <ThemedText type="caption">see all {requests.length}</ThemedText>
                    </TouchableOpacity>
                )}
            </View>
            {requests.slice(0, 4).map((request, index) => (
                <View style={styles.listItem} key={`follow-${request.connectionID}`}>
                    <UserInfoFollowRequest
                        name={request.name}
                        icon={request.icon}
                        username={request.username}
                        userId={request.userId}
                        connectionID={request.connectionID}
                        onRequestHandled={() => removeRequest(request.connectionID)}
                    />
                </View>
            ))}
        </View>
    );
};

const Notifications = () => {
    const ThemedColor = useThemeColor();
    const styles = stylesheet(ThemedColor);
    const now = Date.now();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime();

    const isToday = (time: number) => time >= todayTimestamp;
    const isThisWeek = (time: number) => time >= now - ONE_WEEK && time < todayTimestamp;
    const isThisMonth = (time: number) => time >= now - ONE_MONTH && time < now - ONE_WEEK;
    const isOlder = (time: number) => time < now - ONE_MONTH;

    // Note: follow_requests are now handled within FollowRequestsSection component

    const comment_notifications: CommentNotificationProps[] = [
        {
            name: "Coffee Lover",
            userId: "user456",
            comment: "I love how you approached this problem!",
            icon: Icons.coffee,
            time: now - 45 * 60 * 1000, // 45 minutes ago
            image: Icons.coffee,
        },
        {
            name: "Tea Master",
            userId: "user101",
            comment: "This solution is elegant. I'm impressed!",
            icon: Icons.coffee,
            time: now - 2 * ONE_DAY, // 2 days ago
            image: Icons.latte,
        },
        {
            name: "Design Guru",
            userId: "user303",
            comment: "The UI looks clean and intuitive!",
            icon: Icons.latte,
            time: now - 14 * ONE_DAY, // 2 weeks ago
            image: Icons.luffy,
        },
    ];

    const encouragement_notifications: EncouragementNotificationProps[] = [
        {
            name: "Monkey D. Luffy",
            userId: "user123",
            taskName: "Complete Project Documentation",
            icon: Icons.luffy,
            time: now - 30 * 60 * 1000, // 30 minutes ago
        },
        {
            name: "Team Leader",
            userId: "user321",
            taskName: "Code Review Session",
            icon: Icons.coffee,
            time: now - ONE_DAY, // 1 day ago
        },
        {
            name: "Career Mentor",
            userId: "user246",
            taskName: "Resume Update",
            icon: Icons.coffee,
            time: now - 12 * ONE_DAY, // 12 days ago
        },
    ];

    // Helper functions
    const filterByTimePeriod = <T extends { time: number }>(
        notifications: T[],
        filterFn: (time: number) => boolean
    ): T[] => {
        return notifications.filter((item) => filterFn(item.time));
    };

    const mergeAndSort = (
        commentsArray: CommentNotificationProps[],
        encouragementsArray: EncouragementNotificationProps[]
    ): CombinedNotification[] => {
        const taggedComments = commentsArray.map((item) => ({ ...item, type: "comment" as const }));
        const taggedEncouragements = encouragementsArray.map((item) => ({ ...item, type: "encouragement" as const }));
        return [...taggedComments, ...taggedEncouragements].sort((a, b) => b.time - a.time);
    };

    // Organize notifications by time period
    const todayNotifications = mergeAndSort(
        filterByTimePeriod(comment_notifications, isToday),
        filterByTimePeriod(encouragement_notifications, isToday)
    );

    const thisWeekNotifications = mergeAndSort(
        filterByTimePeriod(comment_notifications, isThisWeek),
        filterByTimePeriod(encouragement_notifications, isThisWeek)
    );

    const thisMonthNotifications = mergeAndSort(
        filterByTimePeriod(comment_notifications, isThisMonth),
        filterByTimePeriod(encouragement_notifications, isThisMonth)
    );

    return (
        <ThemedView style={styles.container}>
            <View style={styles.headerContainer}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="chevron-back" size={24} color={ThemedColor.text} />
                </TouchableOpacity>
                <ThemedText type="subtitle">Notifications</ThemedText>
            </View>
            <ScrollView contentContainerStyle={styles.scrollViewContent}>
                <FollowRequestsSection styles={styles} />
                <NotificationSection title="Today" notifications={todayNotifications} styles={styles} />
                <NotificationSection title="This Week" notifications={thisWeekNotifications} styles={styles} />
                <NotificationSection title="This Month" notifications={thisMonthNotifications} styles={styles} />
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

export default Notifications;
