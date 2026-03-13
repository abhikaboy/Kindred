import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, StyleSheet, TouchableOpacity, FlatList, ViewToken } from "react-native";
import KudosItem from "@/components/cards/KudosItem";
import KudosProgressCard from "@/components/cards/KudosProgressCard";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatDistanceToNow } from "date-fns";
import { KUDOS_CONSTANTS } from "@/constants/kudos";
import { useAuth } from "@/hooks/useAuth";
import { useKudos } from "@/contexts/kudosContext";
import AnimatedTabs, { AnimatedTabContent } from "@/components/inputs/AnimatedTabs";

const TABS = ["Encouragements", "Congratulations"];

export default function Kudos() {
    const { tab } = useLocalSearchParams<{ tab?: string }>();
    const ThemedColor = useThemeColor();
    const insets = useSafeAreaInsets();
    const { user } = useAuth();
    const {
        encouragements,
        congratulations,
        loading,
        markEncouragementsAsRead,
        markCongratulationsAsRead,
    } = useKudos();

    const initialTab = tab === "congratulations" ? 1 : 0;
    const [activeTab, setActiveTab] = useState(initialTab);

    const sentEncouragements = user?.kudosRewards?.encouragements || 0;
    const sentCongratulations = user?.kudosRewards?.congratulations || 0;

    const [encouragementVisibleIds, setEncouragementVisibleIds] = useState<Set<string>>(new Set());
    const [congratulationVisibleIds, setCongratulationVisibleIds] = useState<Set<string>>(new Set());

    const encouragementMarked = useRef(false);
    const congratulationMarked = useRef(false);

    useEffect(() => {
        if (activeTab === 0 && !encouragementMarked.current) {
            encouragementMarked.current = true;
            markEncouragementsAsRead();
        } else if (activeTab === 1 && !congratulationMarked.current) {
            congratulationMarked.current = true;
            markCongratulationsAsRead();
        }
    }, [activeTab]);

    const onEncouragementViewableItemsChanged = useCallback(
        ({ viewableItems }: { viewableItems: ViewToken[] }) => {
            setEncouragementVisibleIds((prev) => {
                const next = new Set(prev);
                viewableItems.forEach(({ item }) => next.add(item.id));
                return next;
            });
        },
        [],
    );

    const onCongratulationViewableItemsChanged = useCallback(
        ({ viewableItems }: { viewableItems: ViewToken[] }) => {
            setCongratulationVisibleIds((prev) => {
                const next = new Set(prev);
                viewableItems.forEach(({ item }) => next.add(item.id));
                return next;
            });
        },
        [],
    );

    const encouragementViewabilityConfig = useRef({ itemVisiblePercentThreshold: 20 }).current;
    const congratulationViewabilityConfig = useRef({ itemVisiblePercentThreshold: 20 }).current;

    const formatTime = (timestamp: string) => {
        try {
            return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
        } catch {
            return "recently";
        }
    };

    const styles = createStyles(ThemedColor, insets);

    const encouragementHeader = (
        <View style={styles.progressCardWrapper}>
            <KudosProgressCard
                current={sentEncouragements}
                max={KUDOS_CONSTANTS.ENCOURAGEMENTS_MAX}
                type="encouragements"
            />
        </View>
    );

    const congratulationHeader = (
        <View style={styles.progressCardWrapper}>
            <KudosProgressCard
                current={sentCongratulations}
                max={KUDOS_CONSTANTS.CONGRATULATIONS_MAX}
                type="congratulations"
            />
        </View>
    );

    const renderEncouragementList = () => {
        if (!loading && encouragements.length === 0) {
            return (
                <View style={styles.emptyContainer}>
                    <ThemedText type="subtitle" style={styles.emptyText}>
                        No encouragements yet
                    </ThemedText>
                    <ThemedText type="lightBody" style={styles.emptySubtext}>
                        When friends encourage you on tasks, they'll appear here
                    </ThemedText>
                </View>
            );
        }

        return (
            <FlatList
                data={encouragements}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                style={styles.scrollView}
                ListHeaderComponent={encouragementHeader}
                ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
                onViewableItemsChanged={onEncouragementViewableItemsChanged}
                viewabilityConfig={encouragementViewabilityConfig}
                renderItem={({ item, index }) => (
                    <KudosItem
                        kudos={item}
                        formatTime={formatTime}
                        visible={encouragementVisibleIds.has(item.id)}
                        index={index}
                    />
                )}
            />
        );
    };

    const renderCongratulationList = () => {
        if (!loading && congratulations.length === 0) {
            return (
                <View style={styles.emptyContainer}>
                    <ThemedText type="subtitle" style={styles.emptyText}>
                        No congratulations yet
                    </ThemedText>
                    <ThemedText type="lightBody" style={styles.emptySubtext}>
                        When friends congratulate you on tasks, they'll appear here
                    </ThemedText>
                </View>
            );
        }

        return (
            <FlatList
                data={congratulations}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                style={styles.scrollView}
                ListHeaderComponent={congratulationHeader}
                ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
                onViewableItemsChanged={onCongratulationViewableItemsChanged}
                viewabilityConfig={congratulationViewabilityConfig}
                renderItem={({ item, index }) => (
                    <KudosItem
                        kudos={item}
                        formatTime={formatTime}
                        visible={congratulationVisibleIds.has(item.id)}
                        index={index}
                    />
                )}
            />
        );
    };

    return (
        <ThemedView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ThemedText type="default" style={styles.backArrow}>
                        ←
                    </ThemedText>
                </TouchableOpacity>
                <ThemedText type="fancyFrauncesHeading" style={styles.title}>
                    Kudos
                </ThemedText>
            </View>

            <AnimatedTabs tabs={TABS} activeTab={activeTab} setActiveTab={setActiveTab} />

            <AnimatedTabContent activeTab={activeTab} setActiveTab={setActiveTab} flex>
                {renderEncouragementList()}
                {renderCongratulationList()}
            </AnimatedTabContent>
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
        progressCardWrapper: {
            marginBottom: 8,
        },
    });
