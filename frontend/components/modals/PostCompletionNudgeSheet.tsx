import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, StyleSheet, TouchableOpacity, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import DefaultModal from "@/components/modals/DefaultModal";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import CachedImage from "@/components/CachedImage";
import BorderGlow from "@/components/ui/BorderGlow";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useAuth } from "@/hooks/useAuth";
import { useUserKudos } from "@/hooks/useUserKudos";
import { useRingUpdate } from "@/contexts/ringUpdateContext";
import { useKudosSent } from "@/contexts/kudosSentContext";
import { getFriendsActivityAPI, getFriendsAPI } from "@/api/connection";
import { getCategoryById } from "@/api/category";
import { createEncouragementAPI } from "@/api/encouragement";
import type { components } from "@/api/generated/types";
import { taskCompletionEvents } from "@/utils/taskCompletionEvents";
import { hapticCompletionBurst } from "@/utils/haptics";
import { showToast } from "@/utils/showToast";
import {
    NUDGE_DEBOUNCE_MS,
    loadNudgeState,
    markNudgeShown,
    nudgeCopy,
    pickCandidate,
    shouldPrompt,
    showNudgeLessOften,
    type NudgeCandidate,
} from "@/utils/postCompletionNudge";

type Friend = components["schemas"]["UserExtendedReference"];

const AVATAR_SIZE = 112;
const GLOW_MS = 1800;
const STALE_MS = 5 * 60 * 1000;

/** Self-mounted: after completions settle, occasionally offers a one-tap nudge for a friend's open task. */
export default function PostCompletionNudgeSheet() {
    const ThemedColor = useThemeColor();
    const styles = useMemo(() => styleSheet(ThemedColor), [ThemedColor]);
    const queryClient = useQueryClient();
    const { user, updateUser } = useAuth();
    const { encouragementsLeft, currentKudosRewards } = useUserKudos();
    const { showRingUpdate } = useRingUpdate();
    const { showKudosSent } = useKudosSent();

    const [visible, setVisible] = useState(false);
    const [candidate, setCandidate] = useState<NudgeCandidate | null>(null);
    const [variant, setVariant] = useState(0);
    const [glowing, setGlowing] = useState(false);
    const [sending, setSending] = useState(false);

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const latest = useRef({ userId: user?._id, encouragementsLeft, visible });
    latest.current = { userId: user?._id, encouragementsLeft, visible };

    const maybePrompt = useCallback(async () => {
        const { userId, encouragementsLeft: left, visible: open } = latest.current;
        if (!userId || left <= 0 || open || AppState.currentState !== "active") return;
        const state = await loadNudgeState();
        if (!shouldPrompt(state, new Date(), Math.random())) return;
        try {
            const friends = await queryClient.fetchQuery({
                queryKey: ["home-friends"],
                queryFn: getFriendsAPI as () => Promise<Friend[]>,
                staleTime: STALE_MS,
            });
            const ids = (friends ?? []).map((f) => f._id).sort();
            if (!ids.length) return;
            const activity = await queryClient.fetchQuery({
                queryKey: ["friends-activity", ids],
                queryFn: () => getFriendsActivityAPI(ids),
                staleTime: STALE_MS,
            });
            const pick = pickCandidate(friends, activity, state.lastFriendId, Math.random(), userId);
            if (!pick || AppState.currentState !== "active") return;
            await markNudgeShown(pick.friend._id);
            setCandidate(pick);
            setVariant(Math.floor(Math.random() * 5));
            setVisible(true);
        } catch {
            // Best-effort prompt; never surface errors from here
        }
    }, [queryClient]);

    useEffect(() => {
        const unsubscribe = taskCompletionEvents.subscribe(() => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(() => void maybePrompt(), NUDGE_DEBOUNCE_MS);
        });
        return () => {
            unsubscribe();
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [maybePrompt]);

    // A brief wash of edge glow as the sheet arrives
    useEffect(() => {
        if (!visible) return;
        setGlowing(true);
        const t = setTimeout(() => setGlowing(false), GLOW_MS);
        return () => clearTimeout(t);
    }, [visible]);

    const firstName = candidate?.friend.display_name?.split(" ")[0] || candidate?.friend.handle || "";
    const copy = candidate ? nudgeCopy(firstName, candidate.task.content, variant) : null;

    const send = async () => {
        if (!candidate || !copy || sending) return;
        if (encouragementsLeft <= 0) {
            showToast("You're out of encouragements for today.", "warning");
            setVisible(false);
            return;
        }
        const { friend, task } = candidate;
        setSending(true);
        try {
            let categoryName = "General";
            if (task.categoryID) {
                const category = await queryClient
                    .fetchQuery({ queryKey: ["category", task.categoryID], queryFn: () => getCategoryById(task.categoryID!) })
                    .catch(() => null);
                categoryName = category?.name || categoryName;
            }
            const result = await createEncouragementAPI({
                receiver: friend._id,
                message: copy.message,
                scope: "task",
                categoryName,
                taskName: task.content,
                taskId: task.id,
                type: "message",
            });
            updateUser({
                encouragements: Math.max(0, encouragementsLeft - 1),
                kudosRewards: { ...currentKudosRewards, encouragements: currentKudosRewards.encouragements + 1 },
            });
            hapticCompletionBurst();
            setVisible(false);
            showRingUpdate(result?.ringDelta);
            queryClient.invalidateQueries({ queryKey: ["rings", "today"] });
            queryClient.invalidateQueries({ queryKey: ["friends-activity"] });
            if (result?.friendshipDelta) queryClient.invalidateQueries({ queryKey: ["profile", friend._id] });
            showKudosSent({
                recipientName: friend.handle || firstName,
                message: copy.message,
                kind: "encouragement",
                taskName: task.content,
                friendship: result?.friendshipDelta,
            });
        } catch {
            showToast("Couldn't send that. Try again.", "danger");
        } finally {
            setSending(false);
        }
    };

    const lessOften = () => {
        void showNudgeLessOften();
        setVisible(false);
        showToast("Got it, you'll see these less often.", "info");
    };

    if (!candidate || !copy) return null;

    return (
        <DefaultModal visible={visible} setVisible={setVisible} enableDynamicSizing customPadding>
            <View style={styles.container}>
                <BorderGlow active={glowing} intensity={0.45} />
                <CachedImage
                    source={{ uri: candidate.friend.profile_picture }}
                    style={styles.avatar}
                    variant="medium"
                    cachePolicy="memory-disk"
                />
                <ThemedText type="titleFraunces" style={styles.center}>
                    {copy.title}
                </ThemedText>
                <ThemedText type="lightBody" style={[styles.center, styles.body]}>
                    {copy.body}
                </ThemedText>
                <PrimaryButton title={copy.cta} onPress={send} disabled={sending} style={styles.cta} />
                <TouchableOpacity onPress={lessOften} hitSlop={12} style={styles.lessOften}>
                    <ThemedText type="caption">Show this less often</ThemedText>
                </TouchableOpacity>
            </View>
        </DefaultModal>
    );
}

const styleSheet = (ThemedColor: ReturnType<typeof useThemeColor>) =>
    StyleSheet.create({
        container: {
            alignItems: "center",
            paddingHorizontal: 24,
            paddingTop: 28,
            paddingBottom: 40,
            overflow: "hidden",
        },
        avatar: {
            width: AVATAR_SIZE,
            height: AVATAR_SIZE,
            borderRadius: AVATAR_SIZE / 2,
            marginBottom: 20,
            backgroundColor: ThemedColor.primary + "20",
        },
        center: { textAlign: "center" },
        body: { marginTop: 8, color: ThemedColor.caption },
        cta: { marginTop: 28 },
        lessOften: { marginTop: 16, paddingVertical: 4 },
    });
