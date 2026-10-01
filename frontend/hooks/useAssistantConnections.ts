import { useCallback, useEffect } from "react";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
    getMcpActivityAPI,
    getMcpTokensAPI,
    getOAuthGrantsAPI,
    getOAuthRequestAPI,
    revokeMcpTokenAPI,
    revokeOAuthGrantAPI,
    type OAuthScope,
} from "@/api/oauth";
import { useAuth } from "@/hooks/useAuth";

export type ConnectionKind = "grant" | "token";

/** A connected assistant: an OAuth grant or a personal access token, flattened for one list. */
export interface AssistantConnection {
    kind: ConnectionKind;
    id: string;
    name: string;
    host?: string;
    verified: boolean;
    logoUri?: string | null;
    scopes: (OAuthScope | string)[];
    createdAt: string;
    lastUsedAt?: string | null;
    tokenPrefix?: string;
}

export const oauthRequestKey = (id: string) => ["oauthRequest", id] as const;

/** A consent request. Never persisted or cached across visits: its status changes server-side. */
export function useOAuthRequest(id: string | undefined) {
    return useQuery({
        queryKey: oauthRequestKey(id ?? ""),
        queryFn: () => getOAuthRequestAPI(id!),
        enabled: !!id,
        staleTime: 0,
        gcTime: 60_000,
        refetchOnWindowFocus: false,
        meta: { persist: false },
    });
}

export const assistantKeys = {
    grants: ["assistantGrants"] as const,
    tokens: ["mcpTokens"] as const,
    activity: (id: string) => ["mcpActivity", id] as const,
};

const byRecentUse = (a: AssistantConnection, b: AssistantConnection) =>
    new Date(b.lastUsedAt ?? b.createdAt).getTime() - new Date(a.lastUsedAt ?? a.createdAt).getTime();

export function useAssistantConnections() {
    const grants = useQuery({ queryKey: assistantKeys.grants, queryFn: getOAuthGrantsAPI });
    const tokens = useQuery({ queryKey: assistantKeys.tokens, queryFn: getMcpTokensAPI });

    const assistants: AssistantConnection[] = (grants.data ?? [])
        .map((g) => ({
            kind: "grant" as const,
            id: g.id,
            name: g.client.name,
            host: g.client.host,
            verified: g.client.verified && g.client.registration !== "dcr",
            logoUri: g.client.logo_uri,
            scopes: g.scopes ?? [],
            createdAt: g.created_at,
            lastUsedAt: g.last_used_at,
        }))
        .sort(byRecentUse);

    const personalTokens: AssistantConnection[] = (tokens.data ?? [])
        .map((t) => ({
            kind: "token" as const,
            id: t.id,
            name: t.name,
            verified: false,
            scopes: t.scopes ?? [],
            createdAt: t.created_at,
            lastUsedAt: t.last_used_at,
            tokenPrefix: t.prefix,
        }))
        .sort(byRecentUse);

    return {
        assistants,
        personalTokens,
        // Tokens predate OAuth; a failure there alone shouldn't blank the page
        isLoading: grants.isLoading || tokens.isLoading,
        isError: grants.isError && tokens.isError,
        refetch: () => Promise.all([grants.refetch(), tokens.refetch()]),
    };
}

export function useAssistantActivity(connectionId: string | undefined) {
    return useQuery({
        queryKey: assistantKeys.activity(connectionId ?? ""),
        queryFn: () => getMcpActivityAPI(connectionId!, 20),
        enabled: !!connectionId,
        staleTime: 30_000,
    });
}

/** Removes the connection from the cached lists right away, then revokes it on the server. */
export function useDisconnectAssistant() {
    const queryClient = useQueryClient();
    return useCallback(
        async (connection: Pick<AssistantConnection, "kind" | "id">) => {
            const key = connection.kind === "grant" ? assistantKeys.grants : assistantKeys.tokens;
            const previous = queryClient.getQueryData<{ id: string }[]>(key);
            queryClient.setQueryData<{ id: string }[]>(key, (list) => list?.filter((c) => c.id !== connection.id));
            try {
                if (connection.kind === "grant") await revokeOAuthGrantAPI(connection.id);
                else await revokeMcpTokenAPI(connection.id);
            } catch (error) {
                queryClient.setQueryData(key, previous);
                throw error;
            } finally {
                queryClient.invalidateQueries({ queryKey: key });
            }
        },
        [queryClient]
    );
}

// A consent link opened while signed out is parked here and resumed after login.
const PENDING_REQUEST_KEY = "pending_oauth_request";
const PENDING_MAX_AGE_MS = 15 * 60_000;

export async function savePendingOAuthRequest(id: string): Promise<void> {
    await AsyncStorage.setItem(PENDING_REQUEST_KEY, JSON.stringify({ id, at: Date.now() }));
}

/** Returns and clears the parked request id, if one is still fresh. */
export async function takePendingOAuthRequest(): Promise<string | null> {
    try {
        const raw = await AsyncStorage.getItem(PENDING_REQUEST_KEY);
        if (!raw) return null;
        await AsyncStorage.removeItem(PENDING_REQUEST_KEY);
        const { id, at } = JSON.parse(raw) as { id?: string; at?: number };
        if (!id || !at || Date.now() - at > PENDING_MAX_AGE_MS) return null;
        return id;
    } catch {
        return null;
    }
}

/** After a login that started from a consent link, reopen that consent screen once. */
export function useResumePendingOAuth() {
    const { user } = useAuth();
    const signedInId = user && !user.isGuest ? user._id : null;
    useEffect(() => {
        if (!signedInId) return;
        let cancelled = false;
        void takePendingOAuthRequest().then((id) => {
            if (id && !cancelled) router.push({ pathname: "/oauth/consent", params: { request: id } });
        });
        return () => {
            cancelled = true;
        };
    }, [signedInId]);
}
