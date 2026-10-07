import React, { useState, useEffect, useMemo, useCallback } from "react";
import { StyleSheet, View, TouchableOpacity, Dimensions } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SearchBox } from "@/components/SearchBox";
import UserInfoRowBase from "@/components/UserInfo/UserInfoRowBase";
import { getFriendsByUserAPI } from "@/api/connection";
import { getProfile } from "@/api/profile";
import { useQuery } from "@tanstack/react-query";
import { SkeletonLoader, UserRowSkeleton } from "@/components/ui/SkeletonLoader";
import { useAuth } from "@/hooks/useAuth";

type FriendRow = {
    _id: string;
    display_name: string;
    handle: string;
    profile_picture: string;
};

export default function UserFriends() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const ThemedColor = useThemeColor();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { user } = useAuth();

    const [searchQuery, setSearchQuery] = useState("");

    const { data: profile } = useQuery({
        queryKey: ["profile", id],
        queryFn: () => getProfile(id as string),
        enabled: !!id,
    });

    const {
        data: friends = [],
        isLoading,
        error,
        refetch,
    } = useQuery<FriendRow[]>({
        queryKey: ["friends-of-user", id],
        queryFn: () => getFriendsByUserAPI(id as string),
        enabled: !!id,
    });

    const filteredFriends = useMemo(() => {
        if (!searchQuery.trim()) return friends;
        const query = searchQuery.toLowerCase();
        return friends.filter(
            (friend) =>
                friend.display_name?.toLowerCase().includes(query) ||
                friend.handle?.toLowerCase().includes(query)
        );
    }, [friends, searchQuery]);

    const handleSearchChange = useCallback((text: string) => {
        setSearchQuery(text);
    }, []);

    const handleFriendPress = useCallback(
        (friendId: string) => {
            router.push(`/account/${friendId}`);
        },
        [router]
    );

    const ownerDisplayName = (profile as any)?.display_name;
    const isOwnProfile = user?._id === id;
    const headerTitle = isOwnProfile
        ? "Friends"
        : ownerDisplayName
        ? `${ownerDisplayName}'s Friends`
        : "Friends";

    const renderFriendItem = useCallback(
        ({ item }: { item: FriendRow }) => (
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

    const renderSkeletonItem = useCallback(
        ({ index }: { index: number }) => (
            <View key={index} style={styles.friendItem}>
                <UserRowSkeleton />
            </View>
        ),
        []
    );

    const Header = (
        <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                <ThemedText type="default" style={styles.backIcon}>
                    ←
                </ThemedText>
            </TouchableOpacity>
            <ThemedText type="subtitle" style={styles.headerTitle} numberOfLines={1}>
                {headerTitle}
            </ThemedText>
            <View style={styles.backButton} />
        </View>
    );

    if (isLoading) {
        return (
            <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
                {Header}
                <View style={styles.searchContainer}>
                    <SearchBox
                        value={searchQuery}
                        placeholder="Search"
                        onChangeText={handleSearchChange}
                        onSubmit={() => {}}
                        recent={false}
                        name="user-friends-search"
                    />
                </View>
                <View style={styles.contentContainer}>
                    <ThemedText type="defaultSemiBold" style={styles.sectionHeader}>
                        FRIENDS
                    </ThemedText>
                    <View style={{ minHeight: 2, flex: 1 }}>
                        <FlashList
                            data={Array(6).fill(0)}
                            renderItem={renderSkeletonItem}
                            estimatedItemSize={60}
                            showsVerticalScrollIndicator={false}
                        />
                    </View>
                </View>
            </ThemedView>
        );
    }

    if (error) {
        const message = (error as Error)?.message?.includes("403")
            ? `You must be connected with ${ownerDisplayName ?? "this user"} to see their friends.`
            : `Error loading friends: ${(error as Error).message}`;
        return (
            <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
                {Header}
                <View style={styles.errorContainer}>
                    <ThemedText type="default" style={{ textAlign: "center" }}>{message}</ThemedText>
                    <TouchableOpacity onPress={() => refetch()} style={styles.retryButton}>
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
            {Header}
            <View style={styles.searchContainer}>
                <SearchBox
                    value={searchQuery}
                    placeholder="Search"
                    onChangeText={handleSearchChange}
                    onSubmit={() => {}}
                    recent={false}
                    name="user-friends-search"
                />
            </View>
            <View style={{ flex: 1, minHeight: 2 }}>
                <FlashList
                    ListHeaderComponent={
                        <View style={styles.section}>
                            <ThemedText type="defaultSemiBold" style={styles.sectionHeader}>
                                FRIENDS
                            </ThemedText>
                        </View>
                    }
                    data={filteredFriends}
                    renderItem={renderFriendItem}
                    keyExtractor={(item) => item._id}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.contentContainer}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <ThemedText type="lightBody" style={[styles.emptyText, { color: ThemedColor.text }]}>
                                {searchQuery ? "No friends found matching your search" : "No friends yet"}
                            </ThemedText>
                        </View>
                    }
                    removeClippedSubviews={true}
                />
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
        flex: 1,
    },
    searchContainer: {
        paddingHorizontal: 20,
        paddingBottom: 16,
    },
    contentContainer: {
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
