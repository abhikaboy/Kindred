import React, { useMemo, useRef, useState } from "react";
import { Image, StyleSheet, TouchableOpacity, View, useColorScheme } from "react-native";
import { useRouter } from "expo-router";
import { AddressBook, CheckIcon, ConfettiIcon, HandWavingIcon, PencilSimpleIcon, UserPlus } from "phosphor-react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import FollowButton from "@/components/inputs/FollowButton";
import { formatHandle } from "@/utils/handle";
import { EmptyIllustration } from "@/components/ui/EmptyIllustration";
import { NOTIOLY_SETS } from "@/assets/images/notioly";
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

const CARD_HEIGHT = 200;
// Person cards stack a graphic, an avatar row and a follow button.
const PERSON_CARD_HEIGHT = 340;
// The intro card is the main call to action, so it gets the most room.
const FIND_CARD_HEIGHT = 330;

const MAX_SUGGESTIONS = 6;
const MAX_QUIET_NUDGES = 2;
const MAX_PEOPLE = 3;
// Once someone has friends the stack leads with kudos, so discovery cards stay few.
const MAX_PEOPLE_WITH_FRIENDS = 2;
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
export type DiscoverPerson = {
    id: string;
    display_name: string;
    handle: string;
    profile_picture: string;
    reason: string;
};
type Suggestion =
    | KudosSuggestion
    | { kind: "person"; id: string; person: DiscoverPerson }
    | { kind: "find"; id: string; friendCount: number };

function buildSuggestions(rows: Row[], primary: string, discover: DiscoverPerson[]): Suggestion[] {
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
    const people: Suggestion[] = discover.slice(0, rows.length > 0 ? MAX_PEOPLE_WITH_FRIENDS : MAX_PEOPLE).map((person) => ({ kind: "person", id: `person-${person.id}`, person }));
    const stack = [...kudos, ...people];
    if (rows.length >= FEW_FRIENDS) return stack;
    const find: Suggestion = { kind: "find", id: "find-friends", friendCount: rows.length };
    // With no friends yet, the intro card leads; otherwise it closes the stack.
    return rows.length === 0 ? [find, ...stack] : [...stack, find];
}

// Fanned stack of who to send kudos to right now; the full friends list scrolls below it.
type FriendSuggestionsProps = {
    rows: Row[];
    discover: DiscoverPerson[];
    onSyncContacts: () => void;
    isSyncing: boolean;
    hasSynced: boolean;
    onInvite: () => void;
};

export default function FriendSuggestions({ rows, discover, onSyncContacts, isSyncing, hasSynced, onInvite }: FriendSuggestionsProps) {
    const ThemedColor = useThemeColor();
    const isDark = useColorScheme() === "dark";
    const stackRef = useRef<SwipeCardStackHandle>(null);
    const [current, setCurrent] = useState(0);
    // A fresh shuffle each time the stack mounts, so each person card gets its own graphic
    const artOrder = useMemo(() => shuffled(NOTIOLY_SETS.people.length), []);
    const suggestions = useMemo(() => buildSuggestions(rows, ThemedColor.primary, discover), [rows, discover, ThemedColor.primary]);
    // The big graphic is for someone with no friends yet; otherwise person cards match the kudos cards
    const withArt = rows.length === 0;
    const heightOf = (x: Suggestion) =>
        x.kind === "find" ? FIND_CARD_HEIGHT : x.kind === "person" && withArt ? PERSON_CARD_HEIGHT : CARD_HEIGHT;
    const personIndex = useMemo(() => new Map(suggestions.filter((x) => x.kind === "person").map((x, i) => [x.id, i])), [suggestions]);
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
                heightOf={heightOf}
                frontColor={isDark ? ThemedColor.lightened : ThemedColor.background}
                backColor={ThemedColor.lightened}
                onIndexChange={setCurrent}
                renderCard={(s) =>
                    s.kind === "kudos" ? (
                        <KudosSuggestionCard suggestion={s} onSent={() => setTimeout(() => stackRef.current?.next(), 400)} />
                    ) : s.kind === "person" ? (
                        <PersonSuggestionCard
                            person={s.person}
                            art={withArt ? NOTIOLY_SETS.people[artOrder[personIndex.get(s.id) ?? 0] % NOTIOLY_SETS.people.length] : undefined}
                        />
                    ) : (
                        <FindFriendsCard friendCount={s.friendCount} onInvite={onInvite} />
                    )
                }
            />
            <View style={styles.footer}>
                {!hasSynced && (
                    <TouchableOpacity
                        onPress={onSyncContacts}
                        disabled={isSyncing}
                        activeOpacity={0.7}
                        accessibilityLabel="Sync contacts"
                        style={[styles.chip, { backgroundColor: ThemedColor.primary + "26" }]}>
                        <AddressBook size={16} color={ThemedColor.primary} />
                        <ThemedText type="smallerDefault" style={{ color: ThemedColor.primary }}>
                            Sync contacts
                        </ThemedText>
                    </TouchableOpacity>
                )}
                {n > 1 ? (
                    <TouchableOpacity
                        onPress={() => stackRef.current?.next()}
                        hitSlop={8}
                        accessibilityLabel="Next suggestion">
                        <ThemedText type="caption" style={{ fontVariant: ["tabular-nums"] }}>
                            {current + 1} of {n}
                        </ThemedText>
                    </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                    onPress={onInvite}
                    activeOpacity={0.7}
                    accessibilityLabel="Invite friends"
                    style={[styles.chip, { backgroundColor: ThemedColor.primary + "26" }]}>
                    <UserPlus size={16} color={ThemedColor.primary} />
                    <ThemedText type="smallerDefault" style={{ color: ThemedColor.primary }}>
                        Invite friends
                    </ThemedText>
                </TouchableOpacity>
            </View>
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

function shuffled(n: number) {
    const a = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function PersonSuggestionCard({ person, art }: { person: DiscoverPerson; art?: number }) {
    const router = useRouter();
    const ThemedColor = useThemeColor();
    // The frame comes first, so the card reads as a suggestion before it reads as a profile
    const label = (
        <ThemedText type="caption" numberOfLines={1} style={{ color: ThemedColor.primary }}>
            Friend suggestion · {person.reason}
        </ThemedText>
    );
    const identity = (
        <View style={styles.personRow}>
            <PreviewIcon size={art === undefined ? "smallMedium" : "medium"} icon={person.profile_picture} />
            <View style={styles.personNames}>
                <ThemedText type="subtitle" numberOfLines={1}>
                    {person.display_name}
                </ThemedText>
                <ThemedText type="caption" numberOfLines={1}>
                    {formatHandle(person.handle)}
                </ThemedText>
            </View>
        </View>
    );
    const follow = (
        <FollowButton
            profile={{
                id: person.id,
                display_name: person.display_name,
                handle: person.handle,
                profile_picture: person.profile_picture,
                tasks_complete: 0,
                friends: [],
            }}
        />
    );

    // With friends: the same compact shape as a kudos card
    if (art === undefined) {
        return (
            <TouchableOpacity activeOpacity={0.9} onPress={() => router.push(`/account/${person.id}`)} style={styles.inner}>
                {label}
                {identity}
                <View>{follow}</View>
            </TouchableOpacity>
        );
    }

    return (
        <TouchableOpacity activeOpacity={0.9} onPress={() => router.push(`/account/${person.id}`)} style={[styles.inner, styles.personInner]}>
            <EmptyIllustration source={art} size={170} tintInDark={false} style={styles.personArt} />
            {label}
            {identity}
            <View style={styles.personFooter}>{follow}</View>
        </TouchableOpacity>
    );
}

function FindFriendsCard({ friendCount, onInvite }: { friendCount: number; onInvite: () => void }) {
    const ThemedColor = useThemeColor();
    return (
        <View style={[styles.inner, styles.findColumn]}>
            <Image source={require("@/assets/images/friend-cards.png")} style={styles.findImage} resizeMode="contain" />
            <View style={{ gap: 4 }}>
                <ThemedText type="subtitle">
                    {friendCount === 0 ? "Your friends live here" : "Bring more friends along"}
                </ThemedText>
                <ThemedText type="caption" numberOfLines={3}>
                    Cheer on their wins and send kudos in a tap. It's way more fun with people you know.
                </ThemedText>
            </View>
            <TouchableOpacity
                onPress={onInvite}
                activeOpacity={0.8}
                style={[styles.action, { backgroundColor: ThemedColor.primary }]}>
                <UserPlus size={14} color="#fff" weight="bold" />
                <ThemedText type="defaultSemiBold" style={styles.actionText}>
                    Invite a friend
                </ThemedText>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { gap: 12, paddingTop: 8, paddingBottom: 16 },
    footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    chip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 100,
    },
    personInner: { justifyContent: "flex-start", gap: 10, paddingTop: 12 },
    personArt: { width: "100%" },
    personFooter: { marginTop: "auto" },
    personRow: { flexDirection: "row", alignItems: "center", gap: 14 },
    personNames: { flex: 1, gap: 2 },
    inner: { flex: 1, padding: 20, justifyContent: "space-between" },
    findColumn: { alignItems: "flex-start", justifyContent: "space-between", gap: 4, padding: 16 },
    findImage: { width: 180, height: 180, alignSelf: "center", marginTop: -16, marginBottom: -14 },
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
