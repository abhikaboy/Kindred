import React, { useCallback } from "react";
import { FlatList, RefreshControl, StyleSheet, TouchableOpacity, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { CaretRightIcon, HandshakeIcon, UsersThreeIcon } from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { getFriendsAPI } from "@/api/connection";
import { getProfile } from "@/api/profile";
import UserInfoRowBase from "@/components/UserInfo/UserInfoRowBase";
import { FriendRings } from "@/components/profile/ProductivityRings";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { UserRowSkeleton } from "@/components/ui/SkeletonLoader";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import type { components } from "@/api/generated/types";

type Friend = components["schemas"]["UserExtendedReference"];

const PROFILE_STALE_MS = 5 * 60 * 1000;

function FriendStat({ value, label }: { value: number; label: string }) {
    const ThemedColor = useThemeColor();
    return (
        <View style={styles.stat}>
            <ThemedText type="defaultSemiBold">{value}</ThemedText>
            <ThemedText type="caption" style={{ color: ThemedColor.caption }}>
                {label}
            </ThemedText>
        </View>
    );
}

function FriendCard({ friend }: { friend: Friend }) {
    const ThemedColor = useThemeColor();
    const router = useRouter();
    const { data: profile } = useQuery({
        queryKey: ["friend-profile", friend._id],
        queryFn: () => getProfile(friend._id),
        staleTime: PROFILE_STALE_MS,
    });

    return (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push(`/account/${friend._id}`)}
            style={[styles.card, { backgroundColor: ThemedColor.lightenedCard, borderColor: ThemedColor.tertiary }]}>
            <UserInfoRowBase
                name={friend.display_name}
                username={friend.handle}
                icon={friend.profile_picture}
                id={friend._id}
                right={<CaretRightIcon size={18} color={ThemedColor.caption} />}
            />
            {profile?.ring_state && (
                <FriendRings
                    ringState={profile.ring_state}
                    userId={friend._id}
                    userHandle={friend.handle}
                    userName={friend.display_name}
                />
            )}
            {profile && (
                <View style={[styles.statsRow, { borderTopColor: ThemedColor.tertiary }]}>
                    <FriendStat value={profile.tasks_complete} label="Tasks done" />
                    <FriendStat value={profile.points} label="Points" />
                    <FriendStat value={profile.posts_made} label="Posts" />
                </View>
            )}
        </TouchableOpacity>
    );
}

// Matches the workspace page header (icon + title + subtitle) for consistency
// across the pager.
function FriendsHeader() {
    const ThemedColor = useThemeColor();
    const insets = useSafeAreaInsets();
    return (
        <View style={{ paddingTop: insets.top + 8, paddingBottom: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <UsersThreeIcon size={28} color={ThemedColor.primary} weight="regular" />
                <ThemedText type="title">Friends</ThemedText>
            </View>
            <ThemedText type="lightBody" style={{ color: ThemedColor.caption, marginTop: 4 }}>
                See what your friends are up to
            </ThemedText>
        </View>
    );
}

export default function FriendsContent() {
    const ThemedColor = useThemeColor();
    const router = useRouter();
    const queryClient = useQueryClient();
    const {
        data: friends,
        isLoading,
        isRefetching,
        refetch,
    } = useQuery({
        queryKey: ["home-friends"],
        queryFn: getFriendsAPI as () => Promise<Friend[]>,
    });

    const onRefresh = useCallback(async () => {
        await Promise.all([refetch(), queryClient.invalidateQueries({ queryKey: ["friend-profile"] })]);
    }, [refetch, queryClient]);

    const renderFriend = useCallback(({ item }: { item: Friend }) => <FriendCard friend={item} />, []);

    if (isLoading) {
        return (
            <View style={styles.listContent}>
                <FriendsHeader />
                {[0, 1, 2, 3].map((i) => (
                    <View
                        key={i}
                        style={[
                            styles.card,
                            { backgroundColor: ThemedColor.lightenedCard, borderColor: ThemedColor.tertiary },
                        ]}>
                        <UserRowSkeleton />
                    </View>
                ))}
            </View>
        );
    }

    return (
        <FlatList
            data={friends ?? []}
            renderItem={renderFriend}
            keyExtractor={(item) => item._id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            ListHeaderComponent={<FriendsHeader />}
            refreshControl={
                <RefreshControl
                    refreshing={isRefetching}
                    onRefresh={onRefresh}
                    colors={[ThemedColor.primary]}
                    tintColor={ThemedColor.primary}
                />
            }
            ListEmptyComponent={
                <View style={styles.emptyContainer}>
                    <View style={[styles.emptyIconRow, { backgroundColor: ThemedColor.primary + "10" }]}>
                        <HandshakeIcon size={32} color={ThemedColor.primary} weight="duotone" />
                    </View>
                    <ThemedText type="subtitle">No friends yet</ThemedText>
                    <ThemedText type="lightBody" style={{ color: ThemedColor.caption }}>
                        Add friends to see their rings and cheer them on as they get things done.
                    </ThemedText>
                    <View style={{ width: "100%", marginTop: 8 }}>
                        <PrimaryButton
                            title="Find friends"
                            secondary
                            onPress={() => router.push("/(logged-in)/(tabs)/(search)/search")}
                        />
                    </View>
                </View>
            }
        />
    );
}

const styles = StyleSheet.create({
    listContent: {
        paddingHorizontal: HORIZONTAL_PADDING,
        paddingBottom: 150,
        gap: 12,
    },
    card: {
        borderWidth: 1,
        borderRadius: 16,
        padding: 16,
        gap: 16,
    },
    statsRow: {
        flexDirection: "row",
        gap: 32,
        borderTopWidth: 1,
        paddingTop: 12,
    },
    stat: {
        alignItems: "flex-start",
    },
    emptyContainer: {
        paddingVertical: 40,
        alignItems: "flex-start",
        gap: 12,
    },
    emptyIconRow: {
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 4,
    },
});
