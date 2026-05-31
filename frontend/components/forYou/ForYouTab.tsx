import React, { useCallback } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import type { ForYouCtaAction, ForYouFeed } from "@/api/forYou";
import { router } from "expo-router";
import ForYouSection from "./ForYouSection";

type Props = {
    horizontalPadding: number;
    feed: ForYouFeed | null;
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
};

export default function ForYouTab({ horizontalPadding, feed, loading, error, refresh }: Props) {
    const ThemedColor = useThemeColor();
    const [refreshing, setRefreshing] = React.useState(false);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await refresh();
        setRefreshing(false);
    }, [refresh]);

    const handleAction = useCallback((action: ForYouCtaAction) => {
        // Phase 1: only `navigate` is wired end-to-end. Other action types
        // log and fall back to a sensible navigation target so the user lands somewhere.
        // Phase 3 will wire send_kudos / send_encouragement / react inline.
        switch (action.type) {
            case "navigate":
                router.push(action.href as never);
                return;
            case "send_kudos":
            case "send_encouragement":
                router.push("/(logged-in)/(tabs)/(task)/kudos" as never);
                return;
            case "react":
                router.push(`/(logged-in)/posting/${action.postId}` as never);
                return;
        }
    }, []);

    if (loading && !feed) {
        return (
            <View style={[styles.center, { paddingHorizontal: horizontalPadding }]}>
                <ActivityIndicator color={ThemedColor.text} />
            </View>
        );
    }

    if (error) {
        return (
            <View style={[styles.center, { paddingHorizontal: horizontalPadding }]}>
                <ThemedText style={{ color: "red", textAlign: "center" }}>{error}</ThemedText>
                <TouchableOpacity onPress={refresh} style={{ marginTop: 16 }}>
                    <ThemedText style={{ color: ThemedColor.text }}>Tap to retry</ThemedText>
                </TouchableOpacity>
            </View>
        );
    }

    if (!feed) return null;

    return (
        <ScrollView
            contentContainerStyle={[styles.scrollContent, { paddingHorizontal: horizontalPadding }]}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ThemedColor.text} />
            }>
            {feed.sections.map((section) => (
                <ForYouSection key={section.id} section={section} onAction={handleAction} />
            ))}
            <View style={{ height: 40 }} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    center: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    scrollContent: {
        paddingBottom: 16,
    },
});
