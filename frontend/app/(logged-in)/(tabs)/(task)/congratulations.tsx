import React, { useEffect, useState } from "react";
import { View, StyleSheet, TouchableOpacity, ScrollView, Image, Dimensions } from "react-native";
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
            setCongratulations(data);

            // Mark all congratulations as read
            if (data.length > 0) {
                try {
                    // Get IDs of unread congratulations
                    const unreadIds = data.filter((con) => !con.read).map((con) => con.id);

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
                                    <Image
                                        source={{ uri: congratulation.sender.picture }}
                                        style={styles.userAvatar}
                                        defaultSource={require("@/assets/images/head.png")}
                                    />
                                    <View style={styles.userInfo}>
                                        <ThemedText type="default" style={styles.userName}>
                                            {congratulation.sender.name}
                                        </ThemedText>
                                        <ThemedText type="caption" style={styles.timeText}>
                                            {formatTime(congratulation.timestamp)}
                                        </ThemedText>
                                    </View>
                                </View>

                                {/* Congratulation Card */}
                                <View style={styles.congratulationCard}>
                                    {/* Unread Indicator */}
                                    {!congratulation.read && <View style={styles.unreadDot} />}

                                    {/* Task Info */}
                                    <View style={styles.taskInfo}>
                                        <ThemedText type="default" style={styles.categoryText}>
                                            {congratulation.categoryName}
                                        </ThemedText>
                                        <View style={styles.dot} />
                                        <ThemedText type="default" style={styles.taskName}>
                                            {congratulation.taskName}
                                        </ThemedText>
                                    </View>

                                    {/* Message */}
                                    <View style={styles.messageContainer}>
                                        <ThemedText type="lightBody" style={styles.messageText}>
                                            {congratulation.message}
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
            paddingTop: 20,
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
        },
        emptyText: {
            fontSize: 20,
            color: ThemedColor.text,
            marginBottom: 8,
        },
        emptySubtext: {
            fontSize: 16,
            color: ThemedColor.caption,
            textAlign: "center",
            lineHeight: 24,
        },
        congratulationsList: {
            gap: 16,
        },
        congratulationItem: {
            gap: 12,
        },
        userSection: {
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
        },
        userAvatar: {
            width: 40,
            height: 40,
            borderRadius: 20,
        },
        userInfo: {
            flex: 1,
        },
        userName: {
            fontSize: 16,
            color: ThemedColor.text,
            fontWeight: "600",
        },
        timeText: {
            fontSize: 14,
            color: ThemedColor.caption,
            marginTop: 2,
        },
        congratulationCard: {
            backgroundColor: ThemedColor.lightened,
            borderRadius: 12,
            padding: 16,
            borderWidth: 1,
            borderColor: ThemedColor.tertiary,
            position: "relative",
        },
        unreadDot: {
            position: "absolute",
            top: 12,
            right: 12,
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: ThemedColor.error,
        },
        taskInfo: {
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 8,
        },
        categoryText: {
            fontSize: 14,
            color: ThemedColor.text,
            fontWeight: "500",
        },
        dot: {
            width: 4,
            height: 4,
            borderRadius: 2,
            backgroundColor: ThemedColor.caption,
            marginHorizontal: 8,
        },
        taskName: {
            fontSize: 14,
            color: ThemedColor.text,
            fontWeight: "500",
        },
        messageContainer: {
            marginTop: 4,
        },
        messageText: {
            fontSize: 16,
            color: ThemedColor.text,
            lineHeight: 24,
        },
    });
