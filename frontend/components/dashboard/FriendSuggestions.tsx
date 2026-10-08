import React, { useMemo, useRef, useState } from "react";
import { StyleSheet, TouchableOpacity, View, useColorScheme } from "react-native";
import { useRouter } from "expo-router";
import { CheckIcon, ConfettiIcon, HandWavingIcon, MagnifyingGlassIcon, PencilSimpleIcon } from "phosphor-react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import PreviewIcon from "@/components/profile/PreviewIcon";
import { ConcentricRings } from "@/components/profile/ProductivityRings";
import { SwipeCardStack, type SwipeCardStackHandle } from "@/components/ui/SwipeCardStack";
import EncourageModal from "@/components/modals/EncourageModal";
import CongratulateModal from "@/components/modals/CongratulateModal";
import {
    buildOptions,
    shortElapsed,
    useCategoryName,
    useQuickKudos,
    type Activity,
    type Friend,
    type Profile,
    type SupportKind,
    type SupportOption,
} from "@/components/dashboard/friendKudos";

const CARD_HEIGHT = 196;
const MAX_SUGGESTIONS = 6;
const MAX_QUIET_NUDGES = 2;
// Below this many friends, the stack ends with a prompt to find more.
const FEW_FRIENDS = 3;

type Row = { friend: Friend; profile?: Profile; activity: Activity };
type KudosSuggestion = {
    kind: "kudos";
    id: string;
    friend: Friend;
    profile?: Profile;
    support: SupportKind;
    option: SupportOption;
    /** the specific thing the kudos is for: a task or a ring */
    subject: string;
    /** why now, e.g. "Maya finished this · 2h ago" */
    reason: string;
};
type Suggestion = KudosSuggestion | { kind: "find"; id: string; friendCount: number };

function buildSuggestions(rows: Row[], primary: string): Suggestion[] {
    const out: KudosSuggestion[] = [];
    let quiet = 0;
    for (const { friend, profile, activity } of rows) {
        const first = friend.display_name.split(" ")[0];
        const base = { kind: "kudos" as const, friend, profile };
        const ago = (iso?: string) => (iso ? ` · ${shortElapsed(iso)} ago` : "");
        if (activity.kind === "finished") {
            const option = buildOptions("congratulate", profile, primary).find((o) => o.task?.id === activity.task.id);
            if (!option) continue;
            out.push({ ...base, id: `congrats-${option.id}`, support: "congratulate", option, subject: activity.task.content, reason: `${first} finished this${ago(activity.since)}` });
        } else if (profile?.ring_state?.all_closed) {
            const option = buildOptions("congratulate", profile, primary).find((o) => o.id === "ring-all");
            if (!option) continue;
            out.push({ ...base, id: `congrats-${friend._id}-rings`, support: "congratulate", option, subject: "Closing every ring", reason: `${first} closed all three today` });
        } else if (activity.kind === "working") {
            const option = buildOptions("nudge", profile, primary).find((o) => o.task?.id === activity.task.id);
            if (!option) continue;
            const since = activity.since ? ` for ${shortElapsed(activity.since)}` : "";
            out.push({ ...base, id: `nudge-${option.id}`, support: "nudge", option, subject: activity.task.content, reason: `${first} has been working on this${since}` });
        } else if (quiet < MAX_QUIET_NUDGES) {
            // Quiet friends only get a nudge when there's a concrete task to point at
            const option = buildOptions("nudge", profile, primary).find((o) => o.task);
            if (!option?.task) continue;
            quiet++;
            out.push({ ...base, id: `nudge-${option.id}`, support: "nudge", option, subject: option.task.content, reason: `On ${first}'s list, not started yet` });
        }
    }
    const kudos: Suggestion[] = out.slice(0, MAX_SUGGESTIONS);
    return rows.length < FEW_FRIENDS ? [...kudos, { kind: "find", id: "find-friends", friendCount: rows.length }] : kudos;
}

// Fanned stack of who to send kudos to right now; the full friends list scrolls below it.
export default function FriendSuggestions({ rows }: { rows: Row[] }) {
    const ThemedColor = useThemeColor();
    const isDark = useColorScheme() === "dark";
    const stackRef = useRef<SwipeCardStackHandle>(null);
    const [current, setCurrent] = useState(0);
    const suggestions = useMemo(() => buildSuggestions(rows, ThemedColor.primary), [rows, ThemedColor.primary]);
    const n = suggestions.length;
    if (!n) return null;

    return (
        <View style={styles.wrap}>
            <SwipeCardStack
                ref={stackRef}
                items={suggestions}
                keyOf={(s) => s.id}
                variant="fan"
                cardHeight={CARD_HEIGHT}
                frontColor={isDark ? ThemedColor.lightened : ThemedColor.background}
                backColor={ThemedColor.lightened}
                onIndexChange={setCurrent}
                renderCard={(s) =>
                    s.kind === "kudos" ? (
                        <KudosSuggestionCard suggestion={s} onSent={() => setTimeout(() => stackRef.current?.next(), 400)} />
                    ) : (
                        <FindFriendsCard friendCount={s.friendCount} />
                    )
                }
            />
            {n > 1 && (
                <TouchableOpacity
                    onPress={() => stackRef.current?.next()}
                    hitSlop={8}
                    style={styles.counter}
                    accessibilityLabel="Next suggestion">
                    <ThemedText type="caption" style={{ fontVariant: ["tabular-nums"] }}>
                        {current + 1} of {n}
                    </ThemedText>
                </TouchableOpacity>
            )}
        </View>
    );
}

function KudosSuggestionCard({ suggestion, onSent }: { suggestion: KudosSuggestion; onSent: () => void }) {
    const ThemedColor = useThemeColor();
    const router = useRouter();
    const { friend, profile, support, option } = suggestion;
    const { send, sendingId, sentIds } = useQuickKudos(friend);
    const [writing, setWriting] = useState(false);
    const { name: categoryName } = useCategoryName(option.task?.categoryID);
    const sent = sentIds.has(`${support}-${option.id}`);
    const Icon = support === "nudge" ? HandWavingIcon : ConfettiIcon;
    const verb = support === "nudge" ? "Cheer on" : "Congratulate";
    const modalTask = option.task
        ? { id: option.task.id, content: option.task.content, value: option.task.value ?? 0, priority: option.task.priority ?? 1, categoryId: option.task.categoryID ?? "" }
        : undefined;
    // The congratulate modal is task-scoped, so ring kudos only get the quick send
    const canWrite = support === "nudge" || !!modalTask;

    const onSend = async () => {
        if (await send(support, option)) onSent();
    };

    return (
        <TouchableOpacity activeOpacity={0.9} onPress={() => router.push(`/account/${friend._id}`)} style={styles.inner}>
            <View style={styles.headerRow}>
                <PreviewIcon size="small" icon={friend.profile_picture} />
                <ThemedText type="caption" numberOfLines={1} style={{ flex: 1 }}>
                    {suggestion.reason}
                </ThemedText>
                {profile?.ring_state && <ConcentricRings rings={profile.ring_state} size={36} strokeWidth={3} gap={2} />}
            </View>
            <ThemedText type="subtitle" numberOfLines={2}>
                {suggestion.subject}
            </ThemedText>
            <View style={styles.actions}>
                <TouchableOpacity
                    onPress={onSend}
                    disabled={sent || !!sendingId}
                    activeOpacity={0.8}
                    style={[styles.action, { backgroundColor: sent ? ThemedColor.primary + "14" : ThemedColor.primary }]}
                    accessibilityLabel={sent ? "Sent" : `${verb} ${friend.display_name}: ${option.message}`}>
                    {sent ? <CheckIcon size={14} color={ThemedColor.primary} weight="bold" /> : <Icon size={14} color="#fff" weight="fill" />}
                    <ThemedText type="defaultSemiBold" style={[styles.actionText, sent && { color: ThemedColor.primary }]}>
                        {sent ? "Sent" : sendingId ? "Sending..." : verb}
                    </ThemedText>
                </TouchableOpacity>
                {canWrite && !sent && (
                    <TouchableOpacity
                        onPress={() => setWriting(true)}
                        activeOpacity={0.8}
                        style={[styles.action, { backgroundColor: ThemedColor.primary + "14" }]}>
                        <PencilSimpleIcon size={14} color={ThemedColor.primary} />
                        <ThemedText type="defaultSemiBold" style={[styles.actionText, { color: ThemedColor.primary }]}>
                            Write
                        </ThemedText>
                    </TouchableOpacity>
                )}
            </View>
            {!sent && (
                <ThemedText type="caption" numberOfLines={1}>
                    Sends "{option.message}"
                </ThemedText>
            )}

            {support === "nudge" ? (
                <EncourageModal
                    visible={writing}
                    setVisible={setWriting}
                    task={modalTask}
                    isProfileLevel={!modalTask}
                    defaultMessage={option.message}
                    encouragementConfig={{ userHandle: friend.handle, receiverId: friend._id, categoryName: categoryName ?? "General" }}
                />
            ) : (
                modalTask && (
                    <CongratulateModal
                        visible={writing}
                        setVisible={setWriting}
                        task={modalTask}
                        onSent={onSent}
                        congratulationConfig={{ userHandle: friend.handle, receiverId: friend._id, categoryName: categoryName ?? "General" }}
                    />
                )
            )}
        </TouchableOpacity>
    );
}

function FindFriendsCard({ friendCount }: { friendCount: number }) {
    const ThemedColor = useThemeColor();
    const router = useRouter();
    return (
        <View style={styles.inner}>
            <View style={{ gap: 4 }}>
                <ThemedText type="subtitle">Find more friends</ThemedText>
                <ThemedText type="caption">
                    {friendCount === 0 ? "No friends yet" : `${friendCount} ${friendCount === 1 ? "friend" : "friends"} so far`}
                </ThemedText>
            </View>
            <TouchableOpacity
                onPress={() => router.push("/(logged-in)/(tabs)/(search)/search")}
                activeOpacity={0.8}
                style={[styles.action, { backgroundColor: ThemedColor.primary }]}>
                <MagnifyingGlassIcon size={14} color="#fff" weight="bold" />
                <ThemedText type="defaultSemiBold" style={styles.actionText}>
                    Search
                </ThemedText>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { gap: 12, paddingTop: 8, paddingBottom: 16 },
    counter: { alignSelf: "center", paddingVertical: 4 },
    inner: { flex: 1, padding: 20, justifyContent: "space-between" },
    headerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    actions: { flexDirection: "row", gap: 8 },
    action: {
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 100,
    },
    actionText: { color: "#fff", fontSize: 15 },
});
