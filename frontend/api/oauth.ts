import client from "@/api/client";
import type { components } from "./generated/types";
import { withAuthHeaders } from "./utils";

// Assistant connections over MCP: OAuth consent requests, OAuth grants, personal
// access tokens and the activity log.

type Schemas = components["schemas"];

export type ScopeId = "kindred:read" | "kindred:write" | "kindred:complete";
export type OAuthClient = Schemas["ClientView"];
export type OAuthScope = Schemas["ScopeView"];
export type OAuthRequest = Schemas["RequestView"];
export type OAuthRequestStatus = OAuthRequest["status"];
export type OAuthGrant = Schemas["GrantView"];
export type McpToken = components["schemas"]["TokenMetadata"];
export type McpActivity = components["schemas"]["ActivityItem"];

/** Carries the HTTP status so screens can tell expired (410), not found (404) and rate limited (429) apart. */
export class OAuthApiError extends Error {
    status: number;
    constructor(what: string, status: number, body: unknown) {
        super(`Failed to ${what}: ${JSON.stringify(body)}`);
        this.name = "OAuthApiError";
        this.status = status;
    }
}

export const errorStatus = (error: unknown): number | undefined =>
    error instanceof OAuthApiError ? error.status : (error as { status?: number } | null)?.status;

type Result = { data?: unknown; error?: unknown; response: Response };

const unwrap = <T>(what: string, { data, error, response }: Result): T => {
    if (error !== undefined || !response.ok) throw new OAuthApiError(what, response.status, error);
    return data as T;
};

export const getOAuthRequestAPI = async (id: string): Promise<OAuthRequest> =>
    unwrap(
        "load connection request",
        await client.GET("/v1/user/oauth/requests/{id}", { params: withAuthHeaders({ path: { id } }) })
    );

/** Looks a request up by its XXXX-XXXX code. Rate limited server-side (429). */
export const getOAuthRequestByCodeAPI = async (code: string): Promise<OAuthRequest> =>
    unwrap(
        "look up connection code",
        await client.GET("/v1/user/oauth/requests/by-code/{code}", {
            params: withAuthHeaders({ path: { code } }),
        })
    );

export const approveOAuthRequestAPI = async (id: string, scopes: string[]): Promise<{ status: OAuthRequestStatus }> =>
    unwrap(
        "approve connection",
        await client.POST("/v1/user/oauth/requests/{id}/approve", {
            params: withAuthHeaders({ path: { id } }),
            body: { scopes },
        })
    );

export const denyOAuthRequestAPI = async (id: string): Promise<{ status: OAuthRequestStatus }> =>
    unwrap(
        "deny connection",
        await client.POST("/v1/user/oauth/requests/{id}/deny", { params: withAuthHeaders({ path: { id } }) })
    );

export const getOAuthGrantsAPI = async (): Promise<OAuthGrant[]> =>
    unwrap<OAuthGrant[] | null>(
        "load connected assistants",
        await client.GET("/v1/user/oauth/grants", { params: withAuthHeaders({}) })
    ) ?? [];

export const revokeOAuthGrantAPI = async (id: string): Promise<void> => {
    unwrap(
        "disconnect assistant",
        await client.DELETE("/v1/user/oauth/grants/{id}", { params: withAuthHeaders({ path: { id } }) })
    );
};

export const getMcpTokensAPI = async (): Promise<McpToken[]> =>
    unwrap<McpToken[] | null>(
        "load access tokens",
        await client.GET("/v1/user/mcp-tokens", { params: withAuthHeaders({}) })
    ) ?? [];

export const revokeMcpTokenAPI = async (id: string): Promise<void> => {
    unwrap(
        "revoke access token",
        await client.DELETE("/v1/user/mcp-tokens/{id}", { params: withAuthHeaders({ path: { id } }) })
    );
};

export const getMcpActivityAPI = async (connectionId: string, limit = 20): Promise<McpActivity[]> =>
    unwrap<McpActivity[] | null>(
        "load activity",
        await client.GET("/v1/user/mcp-activity", {
            params: withAuthHeaders({ query: { connection_id: connectionId, limit } }),
        })
    ) ?? [];
