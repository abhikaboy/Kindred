import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, StyleSheet, TouchableOpacity, FlatList, ViewToken } from "react-native";
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
import { useAuth } from "@/hooks/useAuth";

export default function Encouragements() {
    const ThemedColor = useThemeColor();
    const insets = useSafeAreaInsets();
    const { user } = useAuth();
    const { encouragements, loading, markEncouragementsAsRead } = useKudos();

    const sentEncouragements = user?.kudosRewards?.encouragements || 0;
    const [visibleIds, setVisibleIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        markEncouragementsAsRead();
    }, []);

    const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
        setVisibleIds(prev => {
            const next = new Set(prev);
            viewableItems.forEach(({ item }) => next.add(item.id));
            return next;
        });
    }, []);

    const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 20 }).current;

    const formatTime = (timestamp: string) => {
        try {
            return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
        } catch {
            return "recently";
        }
    };

    const styles = createStyles(ThemedColor, insets);

    const header = (
        <>
            <KudosProgressCard
                current={sentEncouragements}
                max={KUDOS_CONSTANTS.ENCOURAGEMENTS_MAX}
                type="encouragements"
            />
            <ThemedText type="subtitle_subtle" style={{ paddingVertical: 4 }}>
                ENCOURAGEMENTS RECEIVED
            </ThemedText>
        </>
    );

    return (
        <ThemedView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ThemedText type="default" style={styles.backArrow}>←</ThemedText>
                </TouchableOpacity>
                <ThemedText type="fancyFrauncesHeading" style={styles.title}>
                    Encouragements
                </ThemedText>
            </View>

            {!loading && encouragements.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <ThemedText type="subtitle" style={styles.emptyText}>No encouragements yet</ThemedText>
                    <ThemedText type="lightBody" style={styles.emptyText}>
                        When friends encourage you on tasks, they'll appear here
                    </ThemedText>
                </View>
            ) : (
                <FlatList
                    data={encouragements}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    style={styles.scrollView}
                    ListHeaderComponent={header}
                    onViewableItemsChanged={onViewableItemsChanged}
                    viewabilityConfig={viewabilityConfig}
                    renderItem={({ item, index }) => (
                        <KudosItem
                            kudos={item}
                            formatTime={formatTime}
                            visible={visibleIds.has(item.id)}
                            index={index}
                        />
                    )}
                />
            )}
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
            color: ThemedColor.caption,
            textAlign: "center",
            opacity: 0.6,
        },
    });
