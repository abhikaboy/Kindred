import React, { useCallback, useEffect, useMemo, useState } from "react";
import { SectionList, RefreshControl, StyleSheet, TouchableOpacity, View } from "react-native";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { CheckIcon, ConfettiIcon, HandshakeIcon, HandWavingIcon, PencilSimpleIcon, UsersThreeIcon } from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { getFriendsActivityAPI, getFriendsAPI } from "@/api/connection";
import PreviewIcon from "@/components/profile/PreviewIcon";
import { ConcentricRings } from "@/components/profile/ProductivityRings";
import EncourageModal from "@/components/modals/EncourageModal";
import CongratulateModal from "@/components/modals/CongratulateModal";
import DefaultModal from "@/components/modals/DefaultModal";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { UserRowSkeleton } from "@/components/ui/SkeletonLoader";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import FriendSuggestions from "@/components/dashboard/FriendSuggestions";
import {
    ACTIVITY_RANK,
    ACTIVITY_STALE_MS,
    LIVE_DOT_COLOR,
    SECTION_TITLES,
    buildOptions,
    getActivity,
    isToday,
    shortElapsed,
    useCategoryName,
    useQuickKudos,
    type Friend,
    type Profile,
    type SupportKind,
    type SupportOption,
    type TaskDocument,
} from "@/components/dashboard/friendKudos";

function SupportButton({
    label,
    Icon,
    color,
    onPress,
    disabled,
}: {
    label: string;
    Icon: typeof HandWavingIcon;
    color: string;
    onPress: () => void;
    disabled?: boolean;
}) {
    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled}
            activeOpacity={0.7}
            style={[styles.action, { backgroundColor: color + "14", opacity: disabled ? 0.4 : 1 }]}>
            <Icon size={16} color={color} weight="fill" />
            <ThemedText type="default" style={{ color }}>
                {label}
            </ThemedText>
        </TouchableOpacity>
    );
}

const FriendCard = React.memo(function FriendCard({ friend, profile }: { friend: Friend; profile?: Profile }) {
    const ThemedColor = useThemeColor();
    const router = useRouter();
    const [picker, setPicker] = useState<SupportKind | null>(null);
    const [custom, setCustom] = useState<SupportKind | null>(null);
    const { send: sendKudos, sendingId, sentIds } = useQuickKudos(friend);
    const send = async (kind: SupportKind, option: SupportOption) => {
        if (await sendKudos(kind, option)) setPicker(null);
    };

    const activity = getActivity(profile);
    const rings = profile?.ring_state;
    const firstName = friend.display_name.split(" ")[0];
    const nudgeOptions = buildOptions("nudge", profile, ThemedColor.primary);
    const congratsOptions = buildOptions("congratulate", profile, ThemedColor.primary);
    const pickerOptions = picker === "nudge" ? nudgeOptions : congratsOptions;
    const latestFinished = profile?.completed_tasks?.find((t) => isToday(t.timeCompleted));

    const status =
        activity.kind === "working"
            ? `Working on ${activity.task.content}`
            : activity.kind === "finished"
              ? `Finished ${activity.task.content}`
              : rings?.all_closed
                ? "Closed every ring today"
                : "Quiet so far today";
    const statusTime =
        activity.kind === "working"
            ? activity.since && `for ${shortElapsed(activity.since)}`
            : activity.kind === "finished"
              ? activity.since && `${shortElapsed(activity.since)} ago`
              : undefined;

    const openCustom = () => {
        const kind = picker;
        setPicker(null);
        setCustom(kind);
    };

    const toModalTask = (task?: TaskDocument) =>
        task
            ? { id: task.id, content: task.content, value: task.value ?? 0, priority: task.priority ?? 1, categoryId: task.categoryID ?? "" }
            : undefined;
    const workingTask = activity.kind === "working" ? activity.task : undefined;
    const { name: workingCategory } = useCategoryName(workingTask?.categoryID);
    const { name: finishedCategory } = useCategoryName(latestFinished?.categoryID);

    return (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push(`/account/${friend._id}`)}
            style={[styles.card, { backgroundColor: ThemedColor.lightenedCard, borderColor: ThemedColor.tertiary }]}>
            <View style={styles.headerRow}>
                <View style={styles.avatarWrap}>
                    <PreviewIcon size="small" icon={friend.profile_picture} />
                    {activity.kind === "working" && (
                        <View style={[styles.liveDot, { backgroundColor: LIVE_DOT_COLOR, borderColor: ThemedColor.lightenedCard }]} />
                    )}
                </View>
                <View style={{ flex: 1 }}>
                    <ThemedText numberOfLines={1} type="defaultSemiBold">
                        {friend.display_name}
                    </ThemedText>
                    <ThemedText numberOfLines={2} type="caption">
                        {status}
                        {statusTime ? ` · ${statusTime}` : ""}
                    </ThemedText>
                </View>
                {rings && (
                    <ConcentricRings
                        rings={rings}
                        size={56}
                        strokeWidth={5}
                        gap={2}
                    />
                )}
            </View>

            <View style={styles.actionsRow}>
                <SupportButton label="Nudge" Icon={HandWavingIcon} color={ThemedColor.primary} onPress={() => setPicker("nudge")} />
                <SupportButton
                    label="Congratulate"
                    Icon={ConfettiIcon}
                    color={ThemedColor.primary}
                    onPress={() => setPicker("congratulate")}
                    disabled={congratsOptions.length === 0}
                />
            </View>

            <DefaultModal visible={picker !== null} setVisible={(v) => !v && setPicker(null)} enableDynamicSizing>
                <View style={styles.picker}>
                    <ThemedText type="subtitle">
                        {picker === "nudge" ? `Nudge ${firstName} to...` : `Congratulate ${firstName} on...`}
                    </ThemedText>
                    {pickerOptions.map((option) => {
                        const sent = sentIds.has(`${picker}-${option.id}`);
                        return (
                            <TouchableOpacity
                                key={option.id}
                                disabled={sent || !!sendingId}
                                onPress={() => picker && send(picker, option)}
                                activeOpacity={0.7}
                                style={[styles.pickerRow, { borderColor: ThemedColor.tertiary, opacity: sent ? 0.5 : 1 }]}>
                                <View style={[styles.pickerIcon, { backgroundColor: option.color + "1A" }]}>
                                    <option.Icon size={18} color={option.color} weight="fill" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <ThemedText type="default" numberOfLines={1}>
                                        {option.label}
                                    </ThemedText>
                                    <ThemedText type="caption" numberOfLines={1}>
                                        {sent ? "Sent" : sendingId === option.id ? "Sending..." : `"${option.message}"`}
                                    </ThemedText>
                                </View>
                                {sent && <CheckIcon size={16} color={ThemedColor.caption} weight="bold" />}
                            </TouchableOpacity>
                        );
                    })}
                    {(picker === "nudge" || latestFinished) && (
                        <TouchableOpacity onPress={openCustom} activeOpacity={0.7} style={[styles.pickerRow, { borderColor: ThemedColor.tertiary }]}>
                            <View style={[styles.pickerIcon, { backgroundColor: ThemedColor.tertiary }]}>
                                <PencilSimpleIcon size={18} color={ThemedColor.caption} />
                            </View>
                            <ThemedText type="default" style={{ flex: 1 }}>
                                Write your own
                            </ThemedText>
                        </TouchableOpacity>
                    )}
                </View>
            </DefaultModal>

            <EncourageModal
                visible={custom === "nudge"}
                setVisible={(v) => !v && setCustom(null)}
                task={toModalTask(workingTask)}
                isProfileLevel={!workingTask}
                encouragementConfig={{ userHandle: friend.handle, receiverId: friend._id, categoryName: workingCategory ?? "General" }}
            />
            <CongratulateModal
                visible={custom === "congratulate"}
                setVisible={(v) => !v && setCustom(null)}
                task={toModalTask(latestFinished)}
                congratulationConfig={{ userHandle: friend.handle, receiverId: friend._id, categoryName: finishedCategory ?? "General" }}
            />
        </TouchableOpacity>
    );
});

// Matches the workspace page header (icon + title) for consistency across the pager.
function FriendsHeader() {
    const ThemedColor = useThemeColor();
    const insets = useSafeAreaInsets();
    return (
        <View style={{ paddingTop: insets.top + 8, paddingBottom: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <UsersThreeIcon size={28} color={ThemedColor.primary} weight="regular" />
                <ThemedText type="title">Friends</ThemedText>
            </View>
        </View>
    );
}

type FriendsContentProps = {
    // The pager keeps this page mounted while it's a neighbour; hold off the per-friend
    // profile fetches (one request per card) until the page is actually shown.
    isActive?: boolean;
};

function FriendsContent({ isActive = true }: FriendsContentProps) {
    const ThemedColor = useThemeColor();
    const [profilesEnabled, setProfilesEnabled] = useState(isActive);
    useEffect(() => {
        if (isActive) setProfilesEnabled(true);
    }, [isActive]);
    const router = useRouter();
    const {
        data: friends,
        isLoading,
        isRefetching,
        refetch,
    } = useQuery({
        queryKey: ["home-friends"],
        queryFn: getFriendsAPI as () => Promise<Friend[]>,
    });

    const friendIds = useMemo(() => (friends ?? []).map((f) => f._id).sort(), [friends]);
    // One batched request instead of one per friend. Not persisted: rewriting it to disk
    // on every change serialized the whole cache on the JS thread and froze the page.
    const {
        data: activity,
        isPending: activityPending,
        refetch: refetchActivity,
    } = useQuery({
        queryKey: ["friends-activity", friendIds],
        queryFn: () => getFriendsActivityAPI(friendIds),
        enabled: profilesEnabled && friendIds.length > 0,
        staleTime: ACTIVITY_STALE_MS,
        placeholderData: keepPreviousData,
        meta: { persist: false },
    });

    const onRefresh = useCallback(async () => {
        await Promise.all([refetch(), refetchActivity()]);
    }, [refetch, refetchActivity]);

    const { rows, sections } = useMemo(() => {
        const byId = new Map((activity ?? []).map((a) => [a.user_id, a]));
        const rows = (friends ?? []).map((friend) => {
            const profile = byId.get(friend._id);
            return { friend, profile, activity: getActivity(profile) };
        });
        rows.sort((a, b) => {
            const rank = ACTIVITY_RANK[a.activity.kind] - ACTIVITY_RANK[b.activity.kind];
            if (rank) return rank;
            const at = a.activity.kind === "idle" ? "" : a.activity.since ?? "";
            const bt = b.activity.kind === "idle" ? "" : b.activity.since ?? "";
            return bt.localeCompare(at);
        });
        const sections = (["working", "finished", "idle"] as const)
            .map((kind) => ({ title: SECTION_TITLES[kind], data: rows.filter((r) => r.activity.kind === kind) }))
            .filter((section) => section.data.length > 0);
        return { rows, sections };
    }, [friends, activity]);

    // Hold the skeleton until activity lands, so cards don't render as idle and then regroup
    const waitingForActivity = friendIds.length > 0 && activityPending;

    if (isLoading || waitingForActivity) {
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
        <SectionList
            sections={sections}
            renderItem={({ item }) => <FriendCard friend={item.friend} profile={item.profile} />}
            renderSectionHeader={({ section }) =>
                section.title ? (
                    <ThemedText type="caption" style={styles.sectionTitle}>
                        {section.title}
                    </ThemedText>
                ) : null
            }
            keyExtractor={(item) => item.friend._id}
            stickySectionHeadersEnabled={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            ListHeaderComponent={
                <>
                    <FriendsHeader />
                    <FriendSuggestions rows={rows} />
                </>
            }
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

export default React.memo(FriendsContent);

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
        gap: 12,
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
    actionsRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    action: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        paddingVertical: 12,
        borderRadius: 12,
    },
    picker: {
        gap: 8,
        paddingBottom: 32,
    },
    pickerRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
    },
    pickerIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
    },
    sectionTitle: {
        marginTop: 8,
        letterSpacing: 0.5,
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
