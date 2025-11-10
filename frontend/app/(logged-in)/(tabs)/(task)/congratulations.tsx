import React, { useEffect, useState } from "react";
import { View, StyleSheet, TouchableOpacity, ScrollView, Dimensions } from "react-native";
import CachedImage from "@/components/CachedImage";
import KudosItem from "@/components/cards/KudosItem";
import KudosProgressCard from "@/components/cards/KudosProgressCard";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import { router } from "expo-router";
import { getCongratulationsAPI, markCongratulationsReadAPI } from "@/api/congratulation";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatDistanceToNow } from "date-fns";
import { KUDOS_CONSTANTS } from "@/constants/kudos";
import { useAuth } from "@/hooks/useAuth";

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
    const { user } = useAuth();
    const [congratulations, setCongratulations] = useState<Congratulation[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Get sent count from user's kudosRewards for progress tracking
    const sentCongratulations = user?.kudosRewards?.congratulations || 0;

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
                {/* Progress Card - Shows sent count for rewards */}
                <KudosProgressCard
                    current={sentCongratulations}
                    max={KUDOS_CONSTANTS.CONGRATULATIONS_MAX}
                    type="congratulations"
                />
                <ThemedText type="subtitle_subtle" style={{paddingVertical: 4}}>
                    CONGRATULATIONS RECEIVED
                </ThemedText>
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
                            <KudosItem
                                key={congratulation.id}
                                kudos={congratulation}
                                formatTime={formatTime}
                            />
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
            paddingTop: 16,
            paddingBottom: insets.bottom + 16,
            gap: 16,
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
    });
