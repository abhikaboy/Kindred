import React, { useState, useMemo, useCallback } from "react";
import { View, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { getFriendsAPI } from "@/api/connection";
import { getProfile } from "@/api/profile";
import { getUserPosts } from "@/api/post";
import {
    SparkleIcon,
    CameraIcon,
    NotePencilIcon,
    CircleDashedIcon,
    HeartStraightIcon,
} from "phosphor-react-native";
import PreviewIcon from "@/components/profile/PreviewIcon";
import EncourageModal from "@/components/modals/EncourageModal";
import CongratulateModal from "@/components/modals/CongratulateModal";
import { useUserKudos } from "@/hooks/useUserKudos";
import { hapticLight } from "@/utils/haptics";
import type { components } from "@/api/generated/types";

type TaskDocument = components["schemas"]["TaskDocument"];

interface FriendData {
    _id: string;
    display_name: string;
    handle: string;
    profile_picture: string;
    streak: number;
    tasks_complete: number;
    posts_this_week: number;
}

/** A personalized reason to send this friend kudos, most timely first. */
type Reco =
    | { kind: "post"; label: string; post: any }
    | { kind: "task"; label: string; task: TaskDocument }
    | { kind: "ring"; label: string; message: string }
    | { kind: "profile"; label: string };

const POST_FRESH_MS = 48 * 60 * 60 * 1000;
const DETAIL_STALE_MS = 5 * 60 * 1000;

const RING_MESSAGES: Record<string, string> = {
    plan: "Plan out your day and close that ring!",
    do: "Finish up those tasks, you're almost there!",
    share: "Post something or send some kudos to close the ring!",
};

function relTime(iso: string): string {
    const hours = Math.floor((Date.now() - new Date(iso).getTime()) / 36e5);
    if (hours < 1) return "just now";
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return days === 1 ? "yesterday" : `${days}d ago`;
}

function useFriendReco(friendId: string): Reco | null {
    const postQuery = useQuery({
        queryKey: ["friend-latest-post", friendId],
        queryFn: () => getUserPosts(friendId, 1, 0),
        staleTime: DETAIL_STALE_MS,
        select: (res) => res.posts[0] ?? null,
    });
    const profileQuery = useQuery({
        queryKey: ["friend-profile", friendId],
        queryFn: () => getProfile(friendId),
        staleTime: DETAIL_STALE_MS,
    });

    return useMemo(() => {
        if (postQuery.isPending || profileQuery.isPending) return null;

        const post = postQuery.data;
        const createdAt = post?.metadata?.createdAt;
        if (post && createdAt && Date.now() - new Date(createdAt).getTime() < POST_FRESH_MS) {
            return { kind: "post", label: `Posted ${relTime(createdAt)}`, post };
        }

        const profile = profileQuery.data;
        const task = profile?.tasks?.find((t) => t.public);
        if (task) {
            return { kind: "task", label: `Working on “${task.content}”`, task };
        }

        const rings = profile?.ring_state;
        if (rings) {
            const open = (["plan", "do", "share"] as const).filter((key) => !rings[key]?.closed);
            if (open.length > 0) {
                return {
                    kind: "ring",
                    label: `${open.length} ring${open.length > 1 ? "s" : ""} left today`,
                    message: RING_MESSAGES[open[0]],
                };
            }
        }

        return { kind: "profile", label: "Brighten their day" };
    }, [postQuery.isPending, postQuery.data, profileQuery.isPending, profileQuery.data]);
}

const RECO_ICONS = {
    post: CameraIcon,
    task: NotePencilIcon,
    ring: CircleDashedIcon,
    profile: HeartStraightIcon,
} as const;

interface FriendRowProps {
    friend: FriendData;
    isFirst: boolean;
    onKudos: (friend: FriendData, reco: Reco) => void;
}

const FriendRow = React.memo(({ friend, isFirst, onKudos }: FriendRowProps) => {
    const ThemedColor = useThemeColor();
    const styles = useMemo(() => createStyles(ThemedColor), [ThemedColor]);
    const router = useRouter();
    const reco = useFriendReco(friend._id);
    const RecoIcon = reco ? RECO_ICONS[reco.kind] : null;

    return (
        <TouchableOpacity
            style={[styles.row, !isFirst && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: ThemedColor.tertiary }]}
            onPress={() => router.push(`/account/${friend._id}`)}
            activeOpacity={0.7}>
            <PreviewIcon size="smallMedium" icon={friend.profile_picture} />

            <View style={styles.mid}>
                <ThemedText type="defaultSemiBold" numberOfLines={1} style={styles.name}>
                    {friend.display_name}
                </ThemedText>
                <View style={styles.recoLine}>
                    {RecoIcon && <RecoIcon size={13} color={ThemedColor.primary} weight="duotone" />}
                    <ThemedText type="caption" numberOfLines={1} style={styles.recoText}>
                        {reco?.label ?? "…"}
                    </ThemedText>
                </View>
            </View>

            {reco && (
                <TouchableOpacity
                    onPress={() => {
                        hapticLight();
                        onKudos(friend, reco);
                    }}
                    activeOpacity={0.7}
                    hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                    style={styles.ctaRow}>
                    <ThemedText type="defaultSemiBold" style={[styles.ctaText, { color: ThemedColor.primary }]}>
                        {reco.kind === "post" ? "Congrats" : "Encourage"}
                    </ThemedText>
                    <SparkleIcon size={14} color={ThemedColor.primary} weight="duotone" />
                </TouchableOpacity>
            )}
        </TouchableOpacity>
    );
});

export default function FriendsList() {
    const ThemedColor = useThemeColor();
    const styles = useMemo(() => createStyles(ThemedColor), [ThemedColor]);
    const { encouragementsLeft } = useUserKudos();
    const [target, setTarget] = useState<{ friend: FriendData; reco: Reco } | null>(null);
    const [showEncourage, setShowEncourage] = useState(false);
    const [showCongrats, setShowCongrats] = useState(false);

    const { data, isLoading } = useQuery<FriendData[]>({
        queryKey: ["friends"],
        queryFn: getFriendsAPI,
        staleTime: 1000 * 60 * 2,
    });
    const friends = data ?? [];

    const handleKudos = useCallback((friend: FriendData, reco: Reco) => {
        setTarget({ friend, reco });
        if (reco.kind === "post") setShowCongrats(true);
        else setShowEncourage(true);
    }, []);

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator color={ThemedColor.primary} />
            </View>
        );
    }

    if (friends.length === 0) {
        return null;
    }

    const reco = target?.reco;
    const post = reco?.kind === "post" ? reco.post : null;
    const task = reco?.kind === "task" ? reco.task : null;

    return (
        <View style={styles.container}>
            <View style={styles.headerRow}>
                <ThemedText type="fancyFrauncesSubheading">Friends</ThemedText>
                <View style={[styles.sendBudgetPill, { backgroundColor: ThemedColor.primary + "12" }]}>
                    <SparkleIcon size={14} color={ThemedColor.primary} weight="duotone" />
                    <ThemedText type="captionLight" style={{ color: ThemedColor.primary }}>
                        {encouragementsLeft} to send
                    </ThemedText>
                </View>
            </View>
            {friends.map((friend, index) => (
                <FriendRow key={friend._id} friend={friend} isFirst={index === 0} onKudos={handleKudos} />
            ))}

            <EncourageModal
                visible={showEncourage}
                setVisible={setShowEncourage}
                task={
                    task
                        ? {
                              id: task.id,
                              content: task.content,
                              value: task.value ?? 0,
                              priority: task.priority ?? 1,
                              categoryId: task.categoryID ?? "",
                          }
                        : undefined
                }
                isProfileLevel={reco?.kind !== "task"}
                defaultMessage={reco?.kind === "ring" ? reco.message : undefined}
                encouragementConfig={
                    target
                        ? {
                              userHandle: target.friend.handle,
                              receiverId: target.friend._id,
                              categoryName: "",
                          }
                        : undefined
                }
            />

            <CongratulateModal
                visible={showCongrats}
                setVisible={setShowCongrats}
                task={{
                    id: post?.task?.id ?? "",
                    content: post?.task?.content || post?.caption || "their post",
                    value: 0,
                    priority: 1,
                    categoryId: "",
                }}
                congratulationConfig={
                    target
                        ? {
                              userHandle: target.friend.handle,
                              receiverId: target.friend._id,
                              categoryName: post?.task?.category?.name || "General",
                              postId: post?._id,
                          }
                        : undefined
                }
            />
        </View>
    );
}

const createStyles = (ThemedColor: ReturnType<typeof useThemeColor>) =>
    StyleSheet.create({
        container: {
            paddingHorizontal: 16,
            marginBottom: 16,
        },
        headerRow: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 6,
        },
        sendBudgetPill: {
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
            borderRadius: 999,
            paddingHorizontal: 10,
            paddingVertical: 5,
        },
        loadingContainer: {
            paddingVertical: 32,
            alignItems: "center",
        },
        row: {
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            paddingVertical: 12,
        },
        mid: {
            flex: 1,
            minWidth: 0,
            gap: 3,
        },
        name: {
            fontSize: 15,
        },
        recoLine: {
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
        },
        recoText: {
            fontSize: 12.5,
            flexShrink: 1,
        },
        ctaRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
        },
        ctaText: {
            fontSize: 13,
        },
    });
