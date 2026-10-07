import React, { useCallback, useMemo } from "react";
import { View, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Dimensions } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import ContactCard from "@/components/cards/ContactCard";
import { getAllProfiles } from "@/api/profile";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useAuth } from "@/hooks/useAuth";
import type { components } from "@/api/generated/types";

type ProfileDocument = components["schemas"]["ProfileDocument"];

const HORIZONTAL_PADDING = 16;
const COLUMN_GAP = 12;
const CARD_WIDTH = (Dimensions.get("window").width - HORIZONTAL_PADDING * 2 - COLUMN_GAP) / 2;

export default function DiscoverPeople() {
    const ThemedColor = useThemeColor();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { user } = useAuth();
    const currentUserId = user?._id;

    const { data, isLoading, isError, refetch } = useQuery({
        queryKey: ["allProfiles"],
        queryFn: getAllProfiles,
    });

    // Everyone except the current user.
    const profiles = useMemo(
        () => (data ?? []).filter((p) => p.id !== currentUserId),
        [data, currentUserId]
    );

    const renderItem = useCallback(
        ({ item }: { item: ProfileDocument }) => (
            <ContactCard
                width={CARD_WIDTH}
                name={item.display_name}
                icon={item.profile_picture}
                handle={item.handle}
                id={item.id}
                following={false}
            />
        ),
        []
    );

    return (
        <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.headerSide}>
                    <Ionicons name="chevron-back" size={24} color={ThemedColor.text} />
                </TouchableOpacity>
                <ThemedText type="subtitle" style={styles.headerTitle}>
                    Discover People
                </ThemedText>
                <View style={styles.headerSide} />
            </View>

            {isLoading ? (
                <View style={styles.center}>
                    <ActivityIndicator color={ThemedColor.primary} />
                </View>
            ) : isError ? (
                <View style={styles.center}>
                    <ThemedText type="default">Couldn't load people.</ThemedText>
                    <TouchableOpacity onPress={() => refetch()} style={styles.retry}>
                        <ThemedText type="default" style={{ color: ThemedColor.primary }}>
                            Retry
                        </ThemedText>
                    </TouchableOpacity>
                </View>
            ) : profiles.length === 0 ? (
                <View style={styles.center}>
                    <ThemedText type="default">No users found</ThemedText>
                </View>
            ) : (
                <FlatList
                    data={profiles}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id}
                    numColumns={2}
                    columnWrapperStyle={styles.columnWrapper}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                />
            )}
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 20,
        paddingVertical: 16,
    },
    headerSide: {
        width: 32,
    },
    headerTitle: {
        flex: 1,
        textAlign: "center",
    },
    center: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    retry: {
        marginTop: 12,
    },
    columnWrapper: {
        gap: COLUMN_GAP,
        paddingHorizontal: HORIZONTAL_PADDING,
    },
    listContent: {
        gap: 12,
        paddingTop: 8,
        paddingBottom: 100,
    },
});
