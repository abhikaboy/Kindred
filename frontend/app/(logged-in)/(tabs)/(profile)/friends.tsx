import React, { useState, useEffect, useMemo, useCallback } from "react";
import { StyleSheet, View, TouchableOpacity, FlatList, Dimensions } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SearchBox } from "@/components/SearchBox";
import UserInfoRowBase from "@/components/UserInfo/UserInfoRowBase";
import { getFriendsAPI } from "@/api/connection";
import type { components } from "@/api/generated/types";
import { SkeletonLoader, UserRowSkeleton } from "@/components/ui/SkeletonLoader";

type UserExtendedReference = components["schemas"]["UserExtendedReference"];

export default function Friends() {
    const [friends, setFriends] = useState<UserExtendedReference[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");

    const ThemedColor = useThemeColor();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    // Load friends
    const loadFriends = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const friendsData = await getFriendsAPI();
            setFriends(friendsData);
        } catch (err) {
            setError(err.message);
            console.error("Error loading friends:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadFriends();
    }, [loadFriends]);

    // Filter friends based on search query
    const filteredFriends = useMemo(() => {
        if (!searchQuery.trim()) return friends;

        const query = searchQuery.toLowerCase();
        return friends.filter(
            (friend) => friend.display_name.toLowerCase().includes(query) || friend.handle.toLowerCase().includes(query)
        );
    }, [friends, searchQuery]);

    // Handle search input
    const handleSearchChange = useCallback((text: string) => {
        setSearchQuery(text);
    }, []);

    // Handle friend press
    const handleFriendPress = useCallback(
        (friendId: string) => {
            router.push(`/account/${friendId}`);
        },
        [router]
    );

    // Render friend item
    const renderFriendItem = useCallback(
        ({ item }: { item: UserExtendedReference }) => (
            <TouchableOpacity onPress={() => handleFriendPress(item._id)} style={styles.friendItem}>
                <UserInfoRowBase
                    name={item.display_name}
                    username={item.handle}
                    icon={item.profile_picture}
                    id={item._id}
                    right={
                        <ThemedText type="defaultSemiBold" style={styles.arrowIcon}>
                            →
                        </ThemedText>
                    }
                />
            </TouchableOpacity>
        ),
        [handleFriendPress]
    );

    // Render skeleton loading
    const renderSkeletonItem = useCallback(
        ({ index }: { index: number }) => (
            <View key={index} style={styles.friendItem}>
                <UserRowSkeleton />
            </View>
        ),
        []
    );

    // Loading state
    if (loading) {
        return (
            <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <ThemedText type="default" style={styles.backIcon}>
                            ←
                        </ThemedText>
                    </TouchableOpacity>
                    <ThemedText type="subtitle" style={styles.headerTitle}>
                        Friends
                    </ThemedText>
                    <View style={styles.backButton} />
                </View>

                {/* Search Box */}
                <View style={styles.searchContainer}>
                    <SearchBox
                        value={searchQuery}
                        placeholder="Search"
                        onChangeText={handleSearchChange}
                        onSubmit={() => {}}
                        recent={false}
                        name="friends-search"
                    />
                </View>

                {/* Friends Section */}
                <View style={styles.contentContainer}>
                    <ThemedText type="defaultSemiBold" style={[styles.sectionHeader]}>
                        FRIENDS
                    </ThemedText>

                    {/* Skeleton loading */}
                    <FlatList
                        data={Array(6).fill(0)}
                        renderItem={renderSkeletonItem}
                        keyExtractor={(_, index) => `skeleton-${index}`}
                        showsVerticalScrollIndicator={false}
                        scrollEnabled={false}
                    />
                </View>
            </ThemedView>
        );
    }

    // Error state
    if (error) {
        return (
            <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <ThemedText type="default" style={styles.backIcon}>
                            ←
                        </ThemedText>
                    </TouchableOpacity>
                    <ThemedText type="subtitle" style={styles.headerTitle}>
                        Friends
                    </ThemedText>
                    <View style={styles.backButton} />
                </View>

                <View style={styles.errorContainer}>
                    <ThemedText type="default">Error loading friends: {error}</ThemedText>
                    <TouchableOpacity onPress={loadFriends} style={styles.retryButton}>
                        <ThemedText type="default" style={{ color: ThemedColor.primary }}>
                            Retry
                        </ThemedText>
                    </TouchableOpacity>
                </View>
            </ThemedView>
        );
    }

    return (
        <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ThemedText type="default" style={styles.backIcon}>
                        ←
                    </ThemedText>
                </TouchableOpacity>
                <ThemedText type="subtitle" style={styles.headerTitle}>
                    Friends
                </ThemedText>
                <View style={styles.backButton} />
            </View>

            {/* Search Box */}
            <View style={styles.searchContainer}>
                <SearchBox
                    value={searchQuery}
                    placeholder="Search"
                    onChangeText={handleSearchChange}
                    onSubmit={() => {}}
                    recent={false}
                    name="friends-search"
                />
            </View>

            {/* Content */}
            <View style={styles.contentContainer}>
                {/* Friends Section */}
                <View style={styles.section}>
                    <ThemedText type="defaultSemiBold" style={[styles.sectionHeader]}>
                        FRIENDS
                    </ThemedText>

                    {filteredFriends.length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <ThemedText type="lightBody" style={[styles.emptyText, { color: ThemedColor.text }]}>
                                {searchQuery ? "No friends found matching your search" : "No friends yet"}
                            </ThemedText>
                        </View>
                    ) : (
                        <FlatList
                            data={filteredFriends}
                            renderItem={renderFriendItem}
                            keyExtractor={(item) => item._id}
                            showsVerticalScrollIndicator={false}
                            style={styles.friendsList}
                        />
                    )}
                </View>
            </View>
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
        justifyContent: "space-between",
        paddingHorizontal: 20,
        paddingVertical: 16,
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: "center",
        alignItems: "flex-start",
    },
    backIcon: {
        fontSize: 24,
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: "400",
        textAlign: "center",
    },
    searchContainer: {
        paddingHorizontal: 20,
        paddingBottom: 16,
    },
    contentContainer: {
        flex: 1,
        paddingHorizontal: 20,
        paddingBottom: Dimensions.get("window").height * 0.1,
    },
    section: {
        flex: 1,
    },
    sectionHeader: {
        fontSize: 12,
        fontWeight: "400",
        letterSpacing: 0.5,
        marginBottom: 16,
        textTransform: "uppercase",
    },
    friendsList: {
        flex: 1,
    },
    friendItem: {
        marginBottom: 12,
        paddingVertical: 4,
    },
    arrowIcon: {
        fontSize: 18,
    },
    emptyContainer: {
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 40,
    },
    emptyText: {
        textAlign: "center",
        fontSize: 14,
    },
    errorContainer: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 20,
        gap: 16,
    },
    retryButton: {
        paddingVertical: 8,
        paddingHorizontal: 16,
    },
});
