import React, { useEffect, useState } from "react";
import { View, StyleSheet, TouchableOpacity, ScrollView, Dimensions } from "react-native";
import CachedImage from "@/components/CachedImage";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import { router } from "expo-router";
import { getCongratulationsAPI, markCongratulationsReadAPI } from "@/api/congratulation";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatDistanceToNow } from "date-fns";

interface Congratulation {
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

export default function Congratulations() {
    const ThemedColor = useThemeColor();
    const insets = useSafeAreaInsets();
    const [congratulations, setCongratulations] = useState<Congratulation[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchCongratulations();
    }, []);

    const fetchCongratulations = async () => {
        try {
            setLoading(true);
            const data = await getCongratulationsAPI();
            
            // Sort by timestamp in reverse chronological order (newest first)
            const sortedData = [...data].sort((a, b) => {
                return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
            });
            
            setCongratulations(sortedData);

            // Mark all congratulations as read
            if (sortedData.length > 0) {
                try {
                    // Get IDs of unread congratulations
                    const unreadIds = sortedData.filter((con) => !con.read).map((con) => con.id);

                    if (unreadIds.length > 0) {
                        await markCongratulationsReadAPI(unreadIds);
                        // Update local state to mark all as read
                        setCongratulations((prev) => prev.map((con) => ({ ...con, read: true })));
                    }
                } catch (error) {
                    console.error("Error marking congratulations as read:", error);
                }
            }
        } catch (error) {
            console.error("Error fetching congratulations:", error);
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
                    Congratulations
                </ThemedText>
            </View>

            {/* Content */}
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}>
                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ThemedText type="default">Loading congratulations...</ThemedText>
                    </View>
                ) : congratulations.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <ThemedText type="subtitle" style={styles.emptyText}>
                            No congratulations yet
                        </ThemedText>
                        <ThemedText type="lightBody" style={styles.emptySubtext}>
                            When friends congratulate you on tasks, they'll appear here
                        </ThemedText>
                    </View>
                ) : (
                    <View style={styles.congratulationsList}>
                        {congratulations.map((congratulation) => (
                            <View key={congratulation.id} style={styles.congratulationItem}>
                                {/* User Avatar and Info */}
                                <View style={styles.userSection}>
                                    <CachedImage
                                        source={{ uri: congratulation.sender.picture }}
                                        fallbackSource={require("@/assets/images/head.png")}
                                        variant="thumbnail"
                                        cachePolicy="memory-disk"
                                        style={styles.userAvatar}
                                    />
                                    <View style={styles.userInfo}>
                                        <ThemedText type="default" style={styles.userName}>
                                            {congratulation.sender.name}
                                        </ThemedText>
                                    </View>
                                </View>

                                {/* Congratulation Card */}
                                <View style={styles.congratulationCard}>
                                    {/* Unread Indicator */}
                                    {!congratulation.read && <View style={styles.unreadDot} />}

                                    {/* Task Info */}
                                    <View style={styles.taskInfo}>
                                        <ThemedText type="default" style={styles.categoryText} numberOfLines={1}>
                                            {congratulation.categoryName}
                                        </ThemedText>
                                        <View style={styles.dot} />
                                        <ThemedText type="default" style={{...styles.taskName, color: ThemedColor.primary}} numberOfLines={1}>
                                            {congratulation.taskName}
                                        </ThemedText>
                                    </View>

                                    {/* Message */}
                                    <View style={styles.messageContainer}>
                                        <ThemedText type="lightBody" style={styles.messageText}>
                                            {congratulation.message}
                                        </ThemedText>
                                        <ThemedText type="caption" style={styles.timeText}>
                                            {formatTime(congratulation.timestamp)}
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

const createStyles = (ThemedColor: ReturnType<typeof useThemeColor>, insets: any) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: ThemedColor.background,
        },
        header: {
            flexDirection: "row",
            alignItems: "center",
            paddingTop: insets.top + 10,
            paddingBottom: 20,
            paddingHorizontal: HORIZONTAL_PADDING,
            borderBottomWidth: 1,
            borderBottomColor: ThemedColor.tertiary,
        },
        backButton: {
            marginRight: 16,
        },
        backArrow: {
            fontSize: 24,
            color: ThemedColor.text,
        },
        title: {
            fontSize: 24,
            color: ThemedColor.text,
        },
        scrollView: {
            flex: 1,
        },
        scrollContent: {
            paddingHorizontal: HORIZONTAL_PADDING,
            paddingVertical: insets.bottom,
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
        congratulationsList: {
            gap: 16,
        },
        congratulationItem: {
            flexDirection: "row",
        },
        userSection: {
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
            width: Dimensions.get("window").width * 0.2,
        },
        userName: {
            color: ThemedColor.text,
            fontSize: 14,
            width: Dimensions.get("window").width * 0.2,
        },
        timeText: {
            color: ThemedColor.caption,
            fontSize: 12,
            marginTop: 12,
        },
        congratulationCard: {
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
        unreadDot: {
            position: "absolute",
            top: 0,
            right: 0,
            width: 12,
            height: 12,
            borderRadius: 12,
            backgroundColor: ThemedColor.error,
        },
        taskInfo: {
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            marginBottom: 4,
            flexWrap: "nowrap",
        },
        categoryText: {
            color: ThemedColor.primary,
            fontSize: 16,
            flexShrink: 1,
        },
        dot: {
            width: 4,
            height: 4,
            borderRadius: 2,
            backgroundColor: ThemedColor.caption,
            flexShrink: 0,
        },
        taskName: {
            color: ThemedColor.text,
            fontSize: 16,
            flexShrink: 1,
        },
        messageContainer: {
            marginTop: 4,
        },
        messageText: {
            color: ThemedColor.text,
            fontSize: 16,
            lineHeight: 20,
        },
    });
