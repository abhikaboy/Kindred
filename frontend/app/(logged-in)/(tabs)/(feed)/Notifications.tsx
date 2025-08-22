import { Dimensions, StyleSheet, View, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
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
import { useNotifications } from "@/hooks/useNotifications";
import type { components } from "@/api/generated/types";
import { showToast } from "@/utils/showToast";

type NotificationDocument = components["schemas"]["NotificationDocument"];

const ONE_DAY = 24 * 60 * 60 * 1000;
const ONE_WEEK = 7 * ONE_DAY;
const ONE_MONTH = 30 * ONE_DAY;

type FollowRequestProps = {
    name: string;
    username: string;
    icon: string;
    userId: string;
    connectionID: string;
};

type ProcessedNotification = {
    id: string;
    type: "comment" | "encouragement" | "congratulation";
    name: string;
    userId: string;
    time: number;
    icon: string;
    content: string;
    taskName?: string;
    image?: string;
    read: boolean;
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
                    image={notification.image || Icons.coffee}
                />
            ) : notification.type === "encouragement" ? (
                <UserInfoEncouragementNotification
                    name={notification.name}
                    userId={notification.userId}
                    taskName={notification.taskName || "Task"}
                    icon={notification.icon}
                    time={notification.time}
                />
            ) : (
                <UserInfoEncouragementNotification
                    name={notification.name}
                    userId={notification.userId}
                    taskName={notification.taskName || "Task"}
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
    notifications: ProcessedNotification[];
    styles: any;
}) => {
    if (notifications.length === 0) return null;

    return (
        <View style={styles.section}>
            <ThemedText type="subtitle">{title}</ThemedText>
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

// Extract FollowRequestsSection component
const FollowRequestsSection = ({ styles }: { styles: any }) => {
    const [requests, setRequests] = useState<FollowRequestProps[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchFollowRequests = async () => {
        try {
            console.log("FollowRequestsSection - fetching follow requests");
            setLoading(true);
            setError(null);
            
            const connections = await getConnectionsByReceiverAPI();
            console.log("FollowRequestsSection - received connections:", Array.isArray(connections) ? connections.length : connections);
            
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
        console.log("FollowRequestsSection - mount: running fetchFollowRequests");
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
    const { 
        notifications: rawNotifications, 
        loading, 
        error, 
        refreshNotifications 
    } = useNotifications();

    const now = Date.now();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime();

    const isToday = (time: number) => time >= todayTimestamp;
    const isThisWeek = (time: number) => time >= now - ONE_WEEK && time < todayTimestamp;
    const isThisMonth = (time: number) => time >= now - ONE_MONTH && time < now - ONE_WEEK;

    // Convert API notification to processed notification
    const processNotification = (notification: NotificationDocument): ProcessedNotification => {
        const notificationTime = new Date(notification.time).getTime();
        
        // Extract task name from content for encouragement/congratulation notifications
        let taskName = "";
        if (notification.notificationType === "ENCOURAGEMENT" || notification.notificationType === "CONGRATULATION") {
            const match = notification.content.match(/on (.+?):/);
            taskName = match ? match[1] : "Task";
        }

        return {
            id: notification.id,
            type: notification.notificationType.toLowerCase() as "comment" | "encouragement" | "congratulation",
            name: notification.user.display_name,
            userId: notification.user.id,
            time: notificationTime,
            icon: notification.user.profile_picture || Icons.coffee,
            content: notification.content,
            taskName: taskName || undefined,
            image: notification.user.profile_picture || Icons.coffee,
            read: notification.read
        };
    };

    // Convert raw notifications to processed notifications
    const notifications = rawNotifications.map(processNotification);

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

    if (loading) {
        return (
            <ThemedView style={styles.container}>
                <View style={styles.headerContainer}>
                    <TouchableOpacity onPress={() => router.back()}>
                        <Ionicons name="chevron-back" size={24} color={ThemedColor.text} />
                    </TouchableOpacity>
                    <ThemedText type="subtitle">Notifications</ThemedText>
                </View>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={ThemedColor.text} />
                    <ThemedText style={{ marginTop: 16 }}>Loading notifications...</ThemedText>
                </View>
            </ThemedView>
        );
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
                <FollowRequestsSection styles={styles} />
                {error ? (
                    <View style={styles.section}>
                        <ThemedText style={{ textAlign: 'center', color: 'red' }}>{error}</ThemedText>
                        <TouchableOpacity onPress={() => refreshNotifications()} style={{ marginTop: 16, alignItems: 'center' }}>
                            <ThemedText style={{ color: ThemedColor.text }}>Tap to retry</ThemedText>
                        </TouchableOpacity>
                    </View>
                ) : notifications.length === 0 ? (
                    <View style={styles.section}>
                        <ThemedText style={{ textAlign: 'center' }}>No notifications yet</ThemedText>
                    </View>
                ) : (
                    <>
                        <NotificationSection title="Today" notifications={todayNotifications} styles={styles} />
                        <NotificationSection title="This Week" notifications={thisWeekNotifications} styles={styles} />
                        <NotificationSection title="This Month" notifications={thisMonthNotifications} styles={styles} />
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

export default Notifications;
