import React, { useEffect, useState } from "react";
import { View, StyleSheet, TouchableOpacity, ScrollView, Dimensions } from "react-native";
import CachedImage from "@/components/CachedImage";
import KudosItem from "@/components/cards/KudosItem";
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
            
            // Sort by timestamp in reverse chronological order (newest first)
            const sortedData = [...data].sort((a, b) => {
                return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
            });
            
            setEncouragements(sortedData);

            // Mark all encouragements as read
            if (sortedData.length > 0) {
                try {
                    // Get IDs of unread encouragements
                    const unreadIds = sortedData.filter((enc) => !enc.read).map((enc) => enc.id);

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
                            <KudosItem
                                key={encouragement.id}
                                kudos={encouragement}
                                formatTime={formatTime}
                            />
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
        encouragementsList: {
            gap: 16,
        },
    });
