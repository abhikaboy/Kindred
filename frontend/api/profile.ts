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
    console.log("🔍 searchProfiles API called with query:", query);
    console.log("🔍 API URL: /v1/user/profiles/search");
    console.log("🔍 Query params:", query ? { query } : {});
    
    const { data, error } = await client.GET("/v1/user/profiles/search", {
        params: withAuthHeaders({ query: query ? { query } : {} }),
    });

    if (error) {
        console.error("🔍 searchProfiles API error:", error);
        throw new Error(`Failed to search profiles: ${JSON.stringify(error)}`);
    }

    console.log("🔍 searchProfiles raw API response:", data);
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

/**
 * User extended reference with phone number for contact matching
 */
export interface UserExtendedReferenceWithPhone {
    _id: string;
    display_name: string;
    handle: string;
    profile_picture: string;
    phone: string;
}

/**
 * Find users by phone numbers (efficient single-query lookup)
 * This uses a single database query with $in operator for optimal performance
 * Returns users with phone numbers included for contact name mapping
 */
export const findUsersByPhoneNumbers = async (phoneNumbers: string[]): Promise<UserExtendedReferenceWithPhone[]> => {
    // Use the openapi-fetch client with type casting until OpenAPI types are regenerated
    const { data, error } = await (client as any).POST("/v1/profiles/find-by-phone", {
        body: { numbers: phoneNumbers },
    });

    if (error) {
        throw new Error(`Failed to find users by phone numbers: ${JSON.stringify(error)}`);
    }

    return (data as any) || [];
};

/**
 * User extended reference type from generated types
 */
export type UserExtendedReference = components["schemas"]["UserExtendedReference"];

/**
 * Get suggested users (up to 8 users with the most friends)
 * This provides user recommendations for connecting with others
 */
export const getSuggestedUsers = async (): Promise<UserExtendedReference[]> => {
    // Use the openapi-fetch client with type casting until OpenAPI types are regenerated
    const response = await (client as any).GET("/v1/profiles/suggested", {
        params: withAuthHeaders({}),
    });

    if (response.error) {
        throw new Error(`Failed to get suggested users: ${JSON.stringify(response.error)}`);
    }

    return response.data || [];
};

/**
 * User credits type
 */
export interface UserCredits {
    voice: number;
    blueprint: number;
    group: number;
    analytics: number;
    naturalLanguage: number;
}

/**
 * Get user's credit balance
 * Returns the current credit balance for the authenticated user
 */
export const getUserCredits = async (): Promise<UserCredits> => {
    const { data, error } = await (client as any).GET("/v1/user/credits", {
        params: withAuthHeaders({}),
    });

    if (error) {
        throw new Error(`Failed to get user credits: ${JSON.stringify(error)}`);
    }

    return data || { voice: 0, blueprint: 0, group: 0, analytics: 0, naturalLanguage: 0 };
};

/**
 * Update user's timezone
 */
export const updateTimezone = async (timezone: string): Promise<void> => {
    const { error } = await (client as any).POST("/v1/user/timezone", {
        body: { timezone },
    });

    if (error) {
        throw new Error(`Failed to update timezone: ${JSON.stringify(error)}`);
    }
};
