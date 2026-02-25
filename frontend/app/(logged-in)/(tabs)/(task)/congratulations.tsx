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
import { useAuth } from "@/hooks/useAuth";
import { useKudos } from "@/contexts/kudosContext";

export default function Congratulations() {
    const ThemedColor = useThemeColor();
    const insets = useSafeAreaInsets();
    const { user } = useAuth();
    const { congratulations, loading, markCongratulationsAsRead } = useKudos();

    const sentCongratulations = user?.kudosRewards?.congratulations || 0;
    const [visibleIds, setVisibleIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        markCongratulationsAsRead();
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
                current={sentCongratulations}
                max={KUDOS_CONSTANTS.CONGRATULATIONS_MAX}
                type="congratulations"
            />
            <ThemedText type="subtitle_subtle" style={{ paddingVertical: 4 }}>
                CONGRATULATIONS RECEIVED
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
                    Congratulations
                </ThemedText>
            </View>

            {!loading && congratulations.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <ThemedText type="subtitle" style={styles.emptyText}>No congratulations yet</ThemedText>
                    <ThemedText type="lightBody" style={styles.emptySubtext}>
                        When friends congratulate you on tasks, they'll appear here
                    </ThemedText>
                </View>
            ) : (
                <FlatList
                    data={congratulations}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    style={styles.scrollView}
                    ListHeaderComponent={header}
                    ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
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
    });
