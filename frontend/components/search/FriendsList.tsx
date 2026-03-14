import React, { useState, useMemo, useCallback } from "react";
import { View, StyleSheet, TouchableOpacity, Platform, ActivityIndicator } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import CachedImage from "@/components/CachedImage";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { getFriendsAPI } from "@/api/connection";
import { Sparkle, Fire, Camera } from "phosphor-react-native";
import EncourageModal from "@/components/modals/EncourageModal";
import { useAuth } from "@/hooks/useAuth";
import * as Haptics from "expo-haptics";

interface FriendData {
    _id: string;
    display_name: string;
    handle: string;
    profile_picture: string;
    streak: number;
    tasks_complete: number;
    posts_this_week: number;
}

interface FriendRowProps {
    friend: FriendData;
    onEncourage: (friend: FriendData) => void;
}

const FriendRow = React.memo(({ friend, onEncourage }: FriendRowProps) => {
    const ThemedColor = useThemeColor();
    const styles = useMemo(() => createStyles(ThemedColor), [ThemedColor]);
    const router = useRouter();

    const handlePress = () => {
        router.push(`/account/${friend._id}`);
    };

    const handleEncourage = async () => {
        try {
            if (Platform.OS === "ios") {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
        } catch {}
        onEncourage(friend);
    };

    const displayHandle = friend.handle.startsWith("@") ? friend.handle : `@${friend.handle}`;

    return (
        <TouchableOpacity style={styles.row} onPress={handlePress} activeOpacity={0.7}>
            <CachedImage
                source={{ uri: friend.profile_picture }}
                style={styles.avatar}
                contentFit="cover"
                variant="small"
            />

            <View style={styles.info}>
                <ThemedText type="defaultSemiBold" numberOfLines={1} style={styles.name}>
                    {friend.display_name}
                </ThemedText>
                <ThemedText type="captionLight" numberOfLines={1}>
                    {displayHandle}
                </ThemedText>
            </View>

            <View style={styles.stats}>
                {friend.streak > 0 && (
                    <View style={styles.statBadge}>
                        <Fire size={14} color="#F59E0B" weight="fill" />
                        <ThemedText type="captionLight" style={styles.statText}>
                            {friend.streak}
                        </ThemedText>
                    </View>
                )}
                {friend.posts_this_week > 0 && (
                    <View style={[styles.statBadge, styles.postsBadge]}>
                        <Camera size={12} color={ThemedColor.primary} weight="fill" />
                        <ThemedText type="captionLight" style={[styles.statText, { color: ThemedColor.primary }]}>
                            {friend.posts_this_week} {friend.posts_this_week === 1 ? "post" : "posts"}
                        </ThemedText>
                    </View>
                )}
                <View style={styles.statBadge}>
                    <ThemedText type="captionLight" style={styles.statText}>
                        {friend.tasks_complete} done
                    </ThemedText>
                </View>
            </View>

            <TouchableOpacity
                style={styles.encourageButton}
                onPress={handleEncourage}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
                <Sparkle size={18} color="#FFFFFF" weight="fill" />
            </TouchableOpacity>
        </TouchableOpacity>
    );
});

export default function FriendsList() {
    const ThemedColor = useThemeColor();
    const styles = useMemo(() => createStyles(ThemedColor), [ThemedColor]);
    const { user } = useAuth();
    const [encourageTarget, setEncourageTarget] = useState<FriendData | null>(null);
    const [showEncourageModal, setShowEncourageModal] = useState(false);

    const { data: friends = [], isLoading } = useQuery<FriendData[]>({
        queryKey: ["friends"],
        queryFn: getFriendsAPI,
        staleTime: 1000 * 60 * 2,
    });

    const encouragementsLeft = user?.encouragements || 0;

    const handleEncourage = useCallback((friend: FriendData) => {
        setEncourageTarget(friend);
        setShowEncourageModal(true);
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

    return (
        <View style={styles.container}>
            <View style={styles.headerRow}>
                <ThemedText type="subtitle">Your Friends</ThemedText>
                <View style={styles.encouragementSummary}>
                    <Sparkle size={14} color={ThemedColor.primary} weight="fill" />
                    <ThemedText type="captionLight" style={{ color: ThemedColor.primary }}>
                        {encouragementsLeft} to send
                    </ThemedText>
                </View>
            </View>
            {friends.map((friend) => (
                <FriendRow key={friend._id} friend={friend} onEncourage={handleEncourage} />
            ))}

            <EncourageModal
                visible={showEncourageModal}
                setVisible={setShowEncourageModal}
                task={undefined}
                encouragementConfig={
                    encourageTarget
                        ? {
                              userHandle: encourageTarget.handle,
                              receiverId: encourageTarget._id,
                              categoryName: "",
                          }
                        : undefined
                }
                isProfileLevel={true}
            />
        </View>
    );
}

const createStyles = (ThemedColor: ReturnType<typeof useThemeColor>) =>
    StyleSheet.create({
        container: {
            paddingHorizontal: 16,
            gap: 6,
            marginBottom: 16,
        },
        headerRow: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 8,
        },
        encouragementSummary: {
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
        },
        loadingContainer: {
            paddingVertical: 32,
            alignItems: "center",
        },
        row: {
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: ThemedColor.lightenedCard,
            borderRadius: 14,
            padding: 12,
            borderWidth: 0.5,
            borderColor: ThemedColor.tertiary,
        },
        avatar: {
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: ThemedColor.tertiary,
        },
        info: {
            flex: 1,
            marginLeft: 12,
            gap: 1,
        },
        name: {
            fontSize: 15,
        },
        stats: {
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            marginRight: 12,
        },
        statBadge: {
            flexDirection: "row",
            alignItems: "center",
            gap: 3,
            backgroundColor: ThemedColor.tertiary,
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 10,
        },
        postsBadge: {
            backgroundColor: ThemedColor.primary + "15",
        },
        statText: {
            fontSize: 12,
        },
        encourageButton: {
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: ThemedColor.primary,
            justifyContent: "center",
            alignItems: "center",
        },
    });
