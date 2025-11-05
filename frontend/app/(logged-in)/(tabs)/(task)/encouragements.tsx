import React, { useEffect } from "react";
import { View, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
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
import { useKudos } from "@/contexts/kudosContext";

export default function Encouragements() {
    const ThemedColor = useThemeColor();
    const insets = useSafeAreaInsets();
    const { encouragements, totalEncouragementCount, loading, markEncouragementsAsRead } = useKudos();

    useEffect(() => {
        // Mark all as read when viewing the page
        markEncouragementsAsRead();
    }, []);

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

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}>
                {/* Progress Card - Uses shared data */}
                <KudosProgressCard
                    current={totalEncouragementCount}
                    max={KUDOS_CONSTANTS.ENCOURAGEMENTS_MAX}
                    type="encouragements"
                />
                <ThemedText type="subtitle_subtle" style={{ paddingVertical: 4 }}>
                    ENCOURAGEMENTS RECEIVED
                </ThemedText>

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
                            <KudosItem key={encouragement.id} kudos={encouragement} formatTime={formatTime} />
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
        encouragementsList: {
            gap: 16,
        },
    });
