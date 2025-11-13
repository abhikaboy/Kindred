import React, { useEffect, useRef } from "react";
import { View, StyleSheet, TouchableOpacity, ScrollView, Animated } from "react-native";
import KudosItem from "@/components/cards/KudosItem";
import KudosProgressCard from "@/components/cards/KudosProgressCard";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatDistanceToNow } from "date-fns";
import { KUDOS_CONSTANTS } from "@/constants/kudos";
import { useAuth } from "@/hooks/useAuth";
import { useKudos } from "@/contexts/kudosContext";

export default function Congratulations() {
    const ThemedColor = useThemeColor();
    const insets = useSafeAreaInsets();
    const { user } = useAuth();
    const { congratulations, loading, markCongratulationsAsRead } = useKudos();

    // Get sent count from user's kudosRewards for progress tracking
    const sentCongratulations = user?.kudosRewards?.congratulations || 0;

    // Fade-in animation
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Mark all as read when viewing the page
        markCongratulationsAsRead();
    }, []);

    useEffect(() => {
        if (!loading && congratulations.length > 0) {
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 400,
                useNativeDriver: true,
            }).start();
        }
    }, [loading, congratulations.length]);

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
                <ThemedText type="subtitle_subtle" style={{ paddingVertical: 4 }}>
                    CONGRATULATIONS RECEIVED
                </ThemedText>
                {!loading && congratulations.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <ThemedText type="subtitle" style={styles.emptyText}>
                            No congratulations yet
                        </ThemedText>
                        <ThemedText type="lightBody" style={styles.emptySubtext}>
                            When friends congratulate you on tasks, they'll appear here
                        </ThemedText>
                    </View>
                ) : !loading && congratulations.length > 0 ? (
                    <Animated.View style={[styles.congratulationsList, { opacity: fadeAnim }]}>
                        {congratulations.map((congratulation) => (
                            <KudosItem key={congratulation.id} kudos={congratulation} formatTime={formatTime} />
                        ))}
                    </Animated.View>
                ) : null}
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
            marginBottom: 60,
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
