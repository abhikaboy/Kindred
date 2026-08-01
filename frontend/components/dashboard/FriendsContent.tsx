import React, { useCallback, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, TouchableOpacity, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { CaretRightIcon, HandshakeIcon, SparkleIcon, UsersThreeIcon } from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { getFriendsAPI } from "@/api/connection";
import { getProfile } from "@/api/profile";
import PreviewIcon from "@/components/profile/PreviewIcon";
import { FriendRings } from "@/components/profile/ProductivityRings";
import EncourageModal from "@/components/modals/EncourageModal";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { UserRowSkeleton } from "@/components/ui/SkeletonLoader";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import type { components } from "@/api/generated/types";

type Friend = components["schemas"]["UserExtendedReference"];
type TaskDocument = components["schemas"]["TaskDocument"];

const PROFILE_STALE_MS = 5 * 60 * 1000;
const LIVE_DOT_COLOR = "#34C759";

// Mirrors TaskFeedCard/TaskCard's priority dot convention: low=success, medium=warning, high=error.
function priorityDotColor(priority: number, ThemedColor: ReturnType<typeof useThemeColor>) {
    if (priority >= 3) return ThemedColor.error;
    if (priority === 2) return ThemedColor.warning;
    if (priority === 1) return ThemedColor.success;
    return ThemedColor.tertiary;
}

function FriendCard({ friend }: { friend: Friend }) {
    const ThemedColor = useThemeColor();
    const router = useRouter();
    const [activeTask, setActiveTask] = useState<TaskDocument | null>(null);
    const [showEncourage, setShowEncourage] = useState(false);
    const { data: profile } = useQuery({
        queryKey: ["friend-profile", friend._id],
        queryFn: () => getProfile(friend._id),
        staleTime: PROFILE_STALE_MS,
    });

    const inProgressTasks = (profile?.tasks ?? []).filter((t) => t.active || t.workingOnSince).slice(0, 2);

    return (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push(`/account/${friend._id}`)}
            style={[styles.card, { backgroundColor: ThemedColor.lightenedCard, borderColor: ThemedColor.tertiary }]}>
            <View style={styles.headerRow}>
                <View style={styles.avatarWrap}>
                    <PreviewIcon size="small" icon={friend.profile_picture} />
                    {inProgressTasks.length > 0 && (
                        <View
                            style={[
                                styles.liveDot,
                                { backgroundColor: LIVE_DOT_COLOR, borderColor: ThemedColor.lightenedCard },
                            ]}
                        />
                    )}
                </View>
                <View style={{ flex: 1, gap: 0 }}>
                    <ThemedText numberOfLines={1} ellipsizeMode="tail" type="default">
                        {friend.display_name}
                    </ThemedText>
                    <ThemedText numberOfLines={1} ellipsizeMode="tail" type="caption">
                        {friend.handle}
                    </ThemedText>
                </View>
                <CaretRightIcon size={18} color={ThemedColor.caption} />
            </View>
            {profile?.ring_state && (
                <FriendRings
                    ringState={profile.ring_state}
                    userId={friend._id}
                    userHandle={friend.handle}
                    userName={friend.display_name}
                />
            )}
            {inProgressTasks.length > 0 && (
                <View style={styles.inProgressList}>
                    <ThemedText type="subtitle">Working on</ThemedText>
                    {inProgressTasks.map((task) => (
                        <TouchableOpacity
                            key={task.id}
                            style={[
                                styles.taskCard,
                                { borderColor: ThemedColor.tertiary, backgroundColor: ThemedColor.background },
                            ]}
                            activeOpacity={0.7}
                            onPress={() => {
                                setActiveTask(task);
                                setShowEncourage(true);
                            }}>
                            <View style={styles.taskRow}>
                                <View style={styles.taskContentContainer}>
                                    <ThemedText numberOfLines={2} ellipsizeMode="tail" style={styles.taskContent} type="default">
                                        {task.content}
                                    </ThemedText>
                                </View>
                                <View style={styles.taskIndicatorRow}>
                                    <SparkleIcon size={18} color={ThemedColor.primary} weight="duotone" />
                                    <View
                                        style={[styles.priorityDot, { backgroundColor: priorityDotColor(task.priority, ThemedColor) }]}
                                    />
                                </View>
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>
            )}
            <EncourageModal
                visible={showEncourage}
                setVisible={setShowEncourage}
                task={
                    activeTask
                        ? {
                              id: activeTask.id,
                              content: activeTask.content,
                              value: activeTask.value ?? 0,
                              priority: activeTask.priority ?? 1,
                              categoryId: activeTask.categoryID ?? "",
                          }
                        : undefined
                }
                encouragementConfig={{
                    userHandle: friend.handle,
                    receiverId: friend._id,
                    categoryName: "",
                }}
            />
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
    headerRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    avatarWrap: {
        width: 35,
        height: 35,
    },
    liveDot: {
        position: "absolute",
        bottom: -1,
        right: -1,
        width: 12,
        height: 12,
        borderRadius: 6,
        borderWidth: 2,
    },
    inProgressList: {
        gap: 8,
    },
    taskCard: {
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderRadius: 16,
        borderWidth: 1,
        justifyContent: "center",
    },
    taskRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 6,
        minHeight: 20,
    },
    taskContentContainer: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    taskContent: {
        textAlign: "left",
        lineHeight: 24,
    },
    taskIndicatorRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "flex-end",
        flexShrink: 0,
        gap: 8,
        minHeight: 20,
    },
    priorityDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
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
