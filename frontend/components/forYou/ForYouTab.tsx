import React, { useCallback } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import type { ForYouCardType, ForYouCtaAction, ForYouFeed } from "@/api/forYou";
import { router } from "expo-router";
import ForYouSection from "./ForYouSection";

type Props = {
    horizontalPadding: number;
    feed: ForYouFeed | null;
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    onInteraction?: (cardType: ForYouCardType) => void;
    onDismiss?: (cardId: string) => void;
};

export default function ForYouTab({ horizontalPadding, feed, loading, error, refresh, onInteraction, onDismiss }: Props) {
    const ThemedColor = useThemeColor();
    const [refreshing, setRefreshing] = React.useState(false);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await refresh();
        setRefreshing(false);
    }, [refresh]);

    const handleAction = useCallback(
        (action: ForYouCtaAction, cardType: ForYouCardType) => {
            onInteraction?.(cardType);
            // Phase 2 only fully wires `navigate`. Other action types fall through to a
            // sensible navigation target so the user lands somewhere; inline CTA execution
            // (send kudos / react) lands in Phase 3.
            switch (action.type) {
                case "navigate":
                    if (action.href) router.push(action.href as never);
                    return;
                case "send_kudos":
                case "send_encouragement":
                    // Open the sender's profile — that's the surface for composing
                    // a kudos back, encouraging them on their tasks, etc.
                    if (action.targetUserId) {
                        router.push(`/account/${action.targetUserId}` as never);
                    } else {
                        router.push("/(logged-in)/(tabs)/(task)/kudos" as never);
                    }
                    return;
                case "react":
                    if (action.postId) router.push(`/(logged-in)/posting/${action.postId}` as never);
                    return;
            }
        },
        [onInteraction],
    );

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
                <ForYouSection key={section.id} section={section} onAction={handleAction} onDismiss={onDismiss} />
            ))}
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
        paddingBottom: 128,
    },
});
