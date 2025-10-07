import { client } from "@/hooks/useTypedAPI";
import type { paths, components } from "./generated/types";
import { withAuthHeaders } from "./utils";

// Extract the type definitions from the generated types
type ProfileDocument = components["schemas"]["ProfileDocument"];
type UpdateProfileDocument = components["schemas"]["UpdateProfileDocument"];

/**
 * Get a profile by id
 */
export const getProfile = async (id: string): Promise<ProfileDocument> => {
    const { data, error } = await client.GET("/v1/user/profiles/{id}", {
        params: withAuthHeaders({ path: { id } }),
    });

    if (error) {
        throw new Error(`Failed to get profile: ${JSON.stringify(error)}`);
    }

    return data;
};

/**
 * Get all profiles (type-safe)
 */
export const getAllProfiles = async (): Promise<ProfileDocument[]> => {
    const { data, error } = await client.GET("/v1/profiles", {
        params: withAuthHeaders({}),
    });

    if (error) {
        throw new Error(`Failed to get all profiles: ${JSON.stringify(error)}`);
    }

    return data || [];
};

/**
 * Get profile by email (type-safe)
 */
export const getProfileByEmail = async (email: string): Promise<ProfileDocument> => {
    const { data, error } = await client.GET("/v1/profiles/email/{email}", {
        params: withAuthHeaders({ path: { email } }),
    });

    if (error) {
        throw new Error(`Failed to get profile by email: ${JSON.stringify(error)}`);
    }

    return data;
};

/**
 * Get profile by phone (type-safe)
 */
export const getProfileByPhone = async (phone: string): Promise<ProfileDocument> => {
    const { data, error } = await client.GET("/v1/profiles/phone/{phone}", {
        params: withAuthHeaders({ path: { phone } }),
    });

    if (error) {
        throw new Error(`Failed to get profile by phone: ${JSON.stringify(error)}`);
    }

    return data;
};

/**
 * Search profiles (type-safe)
 */
export const searchProfiles = async (query?: string): Promise<ProfileDocument[]> => {
    const { data, error } = await client.GET("/v1/user/profiles/search", {
        params: withAuthHeaders({ query: query ? { query } : {} }),
    });

    if (error) {
        throw new Error(`Failed to search profiles: ${JSON.stringify(error)}`);
    }

    return data || [];
};

/**
 * Autocomplete profiles (type-safe)
 */
export const autocompleteProfiles = async (query: string): Promise<ProfileDocument[]> => {
    if (query.length < 2) return [];
    
    const { data, error } = await client.GET("/v1/user/profiles/autocomplete", {
        params: withAuthHeaders({ query: { query } }),
    });

    if (error) {
        throw new Error(`Failed to autocomplete profiles: ${JSON.stringify(error)}`);
    }

    return data || [];
};

/**
 * Update profile (type-safe)
 */
export const updateProfile = async (id: string, updateData: UpdateProfileDocument): Promise<void> => {
    const { error } = await client.PATCH("/v1/profiles/{id}", {
        params: withAuthHeaders({ path: { id } }),
        body: updateData,
    });

    if (error) {
        throw new Error(`Failed to update profile: ${JSON.stringify(error)}`);
    }
};

/**
 * Delete profile (type-safe)
 */
export const deleteProfile = async (id: string): Promise<void> => {
    const { error } = await client.DELETE("/v1/profiles/{id}", {
        params: withAuthHeaders({ path: { id } }),
    });

    if (error) {
        throw new Error(`Failed to delete profile: ${JSON.stringify(error)}`);
    }
};
