import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Globe, SealCheck, X } from "phosphor-react-native";
import { ThemedText } from "@/components/ThemedText";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { SectionTitle } from "@/components/dashboard/SectionHeader";
import { SettingsToggleRow } from "@/components/settings/SettingsToggleRow";
import AssistantMark from "@/components/assistants/AssistantMark";
import { useThemeColor } from "@/hooks/useThemeColor";
import { assistantKeys, useOAuthRequest } from "@/hooks/useAssistantConnections";
import { approveOAuthRequestAPI, denyOAuthRequestAPI, errorStatus, type OAuthRequest } from "@/api/oauth";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import { TABS_ROUTE } from "@/utils/guestEntry";
import { showToast } from "@/utils/showToast";
import { REQUIRED_SCOPE, isExpired, scopesToApprove, summarizeUserAgent, timeAgo } from "@/utils/assistantConnections";
import { useQueryClient } from "@tanstack/react-query";

type Outcome = "approved" | "denied" | "expired" | "already-approved" | "already-denied" | "invalid" | "unavailable";

const close = () => (router.canGoBack() ? router.back() : router.replace(TABS_ROUTE));

/** Consent for an assistant (MCP OAuth client) asking to connect to this Kindred account. */
export default function OAuthConsent() {
    const ThemedColor = useThemeColor();
    const insets = useSafeAreaInsets();
    const queryClient = useQueryClient();
    const { request: requestId } = useLocalSearchParams<{ request?: string }>();
    const { data: request, error, isLoading, refetch } = useOAuthRequest(requestId);

    const [enabled, setEnabled] = useState<Record<string, boolean>>({});
    const [submitting, setSubmitting] = useState<"approve" | "deny" | null>(null);
    const [outcome, setOutcome] = useState<Outcome | null>(null);

    // Expire in place if the user leaves the screen open past the deadline
    useEffect(() => {
        if (!request?.expires_at || request.status !== "pending") return;
        const ms = new Date(request.expires_at).getTime() - Date.now();
        if (isNaN(ms)) return;
        const t = setTimeout(() => setOutcome((o) => o ?? "expired"), Math.max(0, ms));
        return () => clearTimeout(t);
    }, [request?.expires_at, request?.status]);

    const state: Outcome | "loading" | "consent" = useMemo(() => {
        if (outcome) return outcome;
        if (!requestId) return "invalid";
        if (isLoading && !request) return "loading";
        if (!request) {
            const status = errorStatus(error);
            if (status === 410) return "expired";
            if (status && status >= 400 && status < 500) return "invalid";
            return "unavailable";
        }
        if (request.status === "approved") return "already-approved";
        if (request.status === "denied") return "already-denied";
        if (request.status === "expired" || isExpired(request.expires_at)) return "expired";
        return "consent";
    }, [outcome, requestId, isLoading, request, error]);

    const failed = (e: unknown, what: string) => {
        const status = errorStatus(e);
        if (status === 410) return setOutcome("expired");
        if (status === 409) {
            // Handled elsewhere (another device, or a double tap); show what actually happened
            void refetch();
            return;
        }
        showToast(`Couldn't ${what}. Something went wrong on our end. Give it another try.`, "danger");
    };

    // Taps apply immediately: the buttons lock and relabel on press, no animation in the way
    const approve = async () => {
        if (!request || submitting) return;
        setSubmitting("approve");
        try {
            await approveOAuthRequestAPI(request.id, scopesToApprove(request.scopes, enabled));
            setOutcome("approved");
            queryClient.invalidateQueries({ queryKey: assistantKeys.grants });
        } catch (e) {
            failed(e, "approve this connection");
        } finally {
            setSubmitting(null);
        }
    };

    const deny = async () => {
        if (!request || submitting) return;
        setSubmitting("deny");
        try {
            await denyOAuthRequestAPI(request.id);
            setOutcome("denied");
        } catch (e) {
            failed(e, "deny this request");
        } finally {
            setSubmitting(null);
        }
    };

    const name = request?.client.name ?? "your assistant";

    return (
        <View style={[styles.container, { backgroundColor: ThemedColor.background, paddingTop: insets.top + 8 }]}>
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={close}
                    style={styles.closeButton}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Close">
                    <X size={24} color={ThemedColor.text} weight="bold" />
                </TouchableOpacity>
            </View>

            {state === "loading" ? (
                <View style={styles.center}>
                    <ActivityIndicator color={ThemedColor.caption} />
                </View>
            ) : state === "consent" && request ? (
                <Animated.View key="consent" entering={FadeIn.duration(200)} style={styles.flex}>
                    <ConsentBody
                        request={request}
                        enabled={enabled}
                        onToggle={(id, on) => setEnabled((prev) => ({ ...prev, [id]: on }))}
                    />
                    <View style={[styles.actions, { paddingBottom: insets.bottom + 16 }]}>
                        <PrimaryButton
                            title={submitting === "approve" ? "Approving" : "Approve"}
                            onPress={approve}
                            disabled={!!submitting}
                            testID="oauth-approve"
                        />
                        <PrimaryButton
                            title={submitting === "deny" ? "Denying" : "Deny"}
                            onPress={deny}
                            ghost
                            colorOverride={ThemedColor.text}
                            disabled={!!submitting}
                            testID="oauth-deny"
                        />
                    </View>
                </Animated.View>
            ) : (
                <Animated.View key={state} entering={FadeIn.duration(200)} style={styles.flex}>
                    <ResultBody state={state as Outcome} name={name} onRetry={() => refetch()} />
                </Animated.View>
            )}
        </View>
    );
}

function ConsentBody({
    request,
    enabled,
    onToggle,
}: {
    request: OAuthRequest;
    enabled: Record<string, boolean>;
    onToggle: (id: string, on: boolean) => void;
}) {
    const ThemedColor = useThemeColor();
    const { client, scopes, browser } = request;
    const verified = client.verified && client.registration !== "dcr";
    const requestedAgo = timeAgo(request.requested_at);

    return (
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            <View style={styles.identity}>
                <AssistantMark logoUri={client.logo_uri} size={48} />
                <View style={styles.hostLine}>
                    <ThemedText type="fancyFrauncesSubheading" style={styles.host} numberOfLines={2}>
                        {client.host}
                    </ThemedText>
                    {verified && (
                        <View accessible accessibilityLabel="Verified app">
                            <SealCheck size={22} color={ThemedColor.primary} weight="fill" />
                        </View>
                    )}
                </View>
                <View style={styles.tight}>
                    <ThemedText type="default">{client.name} wants to connect to your Kindred account.</ThemedText>
                    {!verified && <ThemedText type="caption">Unverified app</ThemedText>}
                </View>
            </View>

            <View style={styles.section}>
                <SectionTitle title={`What ${client.name} can do`} />
                <View>
                    {scopes.map((scope, i) => {
                        const required = scope.id === REQUIRED_SCOPE;
                        return (
                            <SettingsToggleRow
                                key={scope.id}
                                label={scope.title}
                                description={required ? `${scope.description} · Required` : scope.description}
                                value={required || enabled[scope.id] !== false}
                                onValueChange={(on) => onToggle(scope.id, on)}
                                disabled={required}
                                isLast={i === scopes.length - 1}
                            />
                        );
                    })}
                </View>
            </View>

            <View style={styles.section}>
                <SectionTitle title="Requested from" />
                <View style={styles.browserRow}>
                    <View style={styles.lead}>
                        <Globe size={20} color={ThemedColor.caption} />
                    </View>
                    <View style={styles.tight}>
                        <ThemedText type="default">{summarizeUserAgent(browser?.user_agent)}</ThemedText>
                        <ThemedText type="caption">
                            {[browser?.ip, requestedAgo].filter(Boolean).join(" · ")}
                        </ThemedText>
                    </View>
                </View>
                <ThemedText type="caption">Only approve if you just started this yourself.</ThemedText>
            </View>
        </ScrollView>
    );
}

const RESULT_COPY: Record<Outcome, (name: string) => { title: string; body: string }> = {
    approved: (name) => ({
        title: `Return to ${name} to continue`,
        body: "You can disconnect it anytime in Settings.",
    }),
    denied: (name) => ({ title: "Request denied", body: `Nothing was shared with ${name}.` }),
    expired: (name) => ({ title: "This request expired", body: `Start the connection again from ${name}.` }),
    "already-approved": (name) => ({ title: "Already approved", body: `Return to ${name} to continue.` }),
    "already-denied": (name) => ({
        title: "This request was denied",
        body: `Start the connection again from ${name} if you want to connect.`,
    }),
    invalid: () => ({
        title: "This link isn't valid",
        body: "Open the latest link from your assistant, or enter its code under Connected assistants in Settings.",
    }),
    unavailable: () => ({ title: "Couldn't load this request", body: "Check your connection and try again." }),
};

function ResultBody({ state, name, onRetry }: { state: Outcome; name: string; onRetry: () => void }) {
    const ThemedColor = useThemeColor();
    const insets = useSafeAreaInsets();
    const copy = RESULT_COPY[state](name);

    return (
        <View style={styles.flex}>
            <View style={[styles.body, styles.tight]}>
                {state === "approved" && (
                    <SealCheck size={32} color={ThemedColor.primary} weight="fill" style={styles.resultIcon} />
                )}
                <ThemedText type="fancyFrauncesSubheading">{copy.title}</ThemedText>
                <ThemedText type="default">{copy.body}</ThemedText>
            </View>
            <View style={[styles.actions, { paddingBottom: insets.bottom + 16 }]}>
                {state === "unavailable" ? (
                    <>
                        <PrimaryButton title="Try again" onPress={onRetry} />
                        <PrimaryButton title="Close" onPress={close} ghost colorOverride={ThemedColor.text} />
                    </>
                ) : (
                    <PrimaryButton title="Done" onPress={close} />
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    flex: {
        flex: 1,
    },
    header: {
        paddingHorizontal: HORIZONTAL_PADDING - 8,
        paddingBottom: 8,
        alignItems: "flex-start",
    },
    closeButton: {
        padding: 8,
    },
    center: {
        paddingTop: 48,
        alignItems: "center",
    },
    body: {
        paddingHorizontal: HORIZONTAL_PADDING,
        paddingTop: 16,
        paddingBottom: 32,
        gap: 32,
    },
    identity: {
        gap: 12,
    },
    hostLine: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    host: {
        flexShrink: 1,
    },
    tight: {
        gap: 4,
    },
    section: {
        gap: 12,
    },
    browserRow: {
        flexDirection: "row",
        alignItems: "center",
    },
    lead: {
        width: 32,
    },
    resultIcon: {
        marginBottom: 12,
    },
    actions: {
        paddingHorizontal: HORIZONTAL_PADDING,
        paddingTop: 12,
        gap: 4,
    },
});
