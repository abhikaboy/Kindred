import React, { useEffect, useState } from "react";
import { View, StyleSheet, TouchableOpacity, ScrollView, Image, Dimensions } from "react-native";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import { router } from "expo-router";
import { getEncouragementsAPI, markEncouragementsReadAPI } from "@/api/encouragement";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatDistanceToNow } from "date-fns";

interface Encouragement {
    id: string;
    sender: {
        name: string;
        picture: string;
        id: string;
    };
    message: string;
    categoryName: string;
    taskName: string;
    timestamp: string;
    read: boolean;
}

export default function Encouragements() {
    const ThemedColor = useThemeColor();
    const insets = useSafeAreaInsets();
    const [encouragements, setEncouragements] = useState<Encouragement[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchEncouragements();
    }, []);

    const fetchEncouragements = async () => {
        try {
            setLoading(true);
            const data = await getEncouragementsAPI();
            setEncouragements(data);

            // Mark all encouragements as read
            if (data.length > 0) {
                try {
                    // Get IDs of unread encouragements
                    const unreadIds = data.filter((enc) => !enc.read).map((enc) => enc.id);

                    if (unreadIds.length > 0) {
                        await markEncouragementsReadAPI(unreadIds);
                        // Update local state to mark all as read
                        setEncouragements((prev) => prev.map((enc) => ({ ...enc, read: true })));
                    }
                } catch (error) {
                    console.error("Error marking encouragements as read:", error);
                }
            }
        } catch (error) {
            console.error("Error fetching encouragements:", error);
        } finally {
            setLoading(false);
        }
    };

    const formatTime = (timestamp: string) => {
        try {
            return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
        } catch (error) {
            return "recently";
        }
    };

    const styles = createStyles(ThemedColor, insets);

    return (
        <ThemedView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ThemedText type="default" style={styles.backArrow}>
                        ←
                    </ThemedText>
                </TouchableOpacity>
                <ThemedText type="fancyFrauncesHeading" style={styles.title}>
                    Encouragements
                </ThemedText>
            </View>

            {/* Content */}
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}>
                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ThemedText type="default">Loading encouragements...</ThemedText>
                    </View>
                ) : encouragements.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <ThemedText type="subtitle" style={styles.emptyText}>
                            No encouragements yet
                        </ThemedText>
                        <ThemedText type="lightBody" style={styles.emptySubtext}>
                            When friends encourage you on tasks, they'll appear here
                        </ThemedText>
                    </View>
                ) : (
                    <View style={styles.encouragementsList}>
                        {encouragements.map((encouragement) => (
                            <View key={encouragement.id} style={styles.encouragementItem}>
                                {/* User Avatar and Info */}
                                <View style={styles.userSection}>
                                    <Image
                                        source={{ uri: encouragement.sender.picture }}
                                        style={styles.userAvatar}
                                        defaultSource={require("@/assets/images/head.png")}
                                    />
                                    <View style={styles.userInfo}>
                                        <ThemedText type="default" style={styles.userName}>
                                            {encouragement.sender.name}
                                        </ThemedText>
                                        <ThemedText type="caption" style={styles.timeText}>
                                            {formatTime(encouragement.timestamp)}
                                        </ThemedText>
                                    </View>
                                </View>

                                {/* Encouragement Card */}
                                <View style={styles.encouragementCard}>
                                    {/* Unread Indicator */}
                                    {!encouragement.read && <View style={styles.unreadDot} />}

                                    {/* Task Info */}
                                    <View style={styles.taskInfo}>
                                        <ThemedText type="default" style={styles.categoryText}>
                                            {encouragement.categoryName}
                                        </ThemedText>
                                        <View style={styles.dot} />
                                        <ThemedText type="default" style={styles.taskName}>
                                            {encouragement.taskName}
                                        </ThemedText>
                                    </View>

                                    {/* Message */}
                                    <View style={styles.messageContainer}>
                                        <ThemedText type="lightBody" style={styles.messageText}>
                                            {encouragement.message}
                                        </ThemedText>
                                    </View>
                                </View>
                            </View>
                        ))}
                    </View>
                )}
            </ScrollView>
        </ThemedView>
    );
}

const createStyles = (ThemedColor: any, insets: any) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: ThemedColor.background,
        },
        header: {
            flexDirection: "column",
            alignItems: "flex-start",
            paddingTop: insets.top - 8,
            paddingHorizontal: HORIZONTAL_PADDING,
            paddingBottom: 32,
            gap: 16,
        },
        backButton: {
            padding: 4,
        },
        backArrow: {
            fontSize: 24,
            color: ThemedColor.text,
        },
        title: {
            color: ThemedColor.text,
            fontSize: 36,
            fontFamily: "Fraunces",
            fontWeight: "600",
            letterSpacing: -1,
        },
        scrollView: {
            flex: 1,
        },
        scrollContent: {
            paddingHorizontal: HORIZONTAL_PADDING,
            paddingBottom: insets.bottom + 20,
        },
        loadingContainer: {
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            paddingTop: 100,
        },
        emptyContainer: {
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            paddingTop: 100,
            gap: 8,
        },
        emptyText: {
            color: ThemedColor.text,
            textAlign: "center",
        },
        emptySubtext: {
            color: ThemedColor.caption,
            textAlign: "center",
        },
        encouragementsList: {
            gap: 16,
        },
        encouragementItem: {
            flexDirection: "row",
            gap: 24,
            alignItems: "flex-start",
        },
        userSection: {
            alignItems: "center",
            gap: 8,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 2,
        },
        userAvatar: {
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: ThemedColor.tertiary,
        },
        userInfo: {
            alignItems: "center",
        },
        userName: {
            color: ThemedColor.text,
            fontSize: 14,
            textAlign: "center",
        },
        timeText: {
            color: ThemedColor.caption,
            fontSize: 10,
            textAlign: "center",
        },
        encouragementCard: {
            flex: 1,
            backgroundColor: ThemedColor.lightened,
            borderRadius: 12,
            padding: 16,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 2,
        },
        taskInfo: {
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            marginBottom: 12,
        },
        categoryText: {
            color: ThemedColor.primary,
            fontSize: 16,
        },
        dot: {
            width: 4,
            height: 4,
            borderRadius: 2,
            backgroundColor: ThemedColor.caption,
        },
        taskName: {
            color: ThemedColor.text,
            fontSize: 16,
        },
        messageContainer: {
            marginTop: 4,
        },
        messageText: {
            color: ThemedColor.text,
            fontSize: 16,
            lineHeight: 24,
        },
        unreadDot: {
            position: "absolute",
            top: 0,
            right: 0,
            width: 12,
            height: 12,
            borderRadius: 12,
            backgroundColor: ThemedColor.error,
        },
    });
