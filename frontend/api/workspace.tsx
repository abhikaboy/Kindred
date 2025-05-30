import React from "react";
import { showToastable } from "react-native-toastable";
import { Categories, Workspace } from "./types";
import { useRequest } from "@/hooks/useRequest";
import { showToast } from "@/utils/showToast";

/**
 * Creates a new workspace
 * API: Makes POST request to create a new workspace with a proxy category
 * Frontend: The response is used to update the workspaces state in TaskContext
 * Note: Uses a special "!-proxy-!" category name as a placeholder
 * @param name - The name of the workspace to create
 * @throws {Error} When the request fails or workspace creation is invalid
 */
export const createWorkspace = async (name: string): Promise<Categories> => {
    try {
        const { request } = useRequest();
        showToast("Workspace created!", "success");
        return await request("POST", `/user/categories`, {
            name: "!-proxy-!",
            workspaceName: name,
        });
    } catch (error) {
        // Log the error for debugging
        console.error("Workspace creation failed:", error);
        showToast("Failed to create workspace. Please try again later.", "danger");
        // Re-throw with a more user-friendly message
        throw new Error("Failed to create workspace. Please try again later.");
    }
};

/**
 * Fetches all workspaces for a user
 * API: Makes GET request to fetch workspaces from backend
 * Frontend: Data is used to update workspaces state in TaskContext
 * @param userId - The ID of the user whose workspaces to fetch
 * @throws {Error} When the request fails or user ID is invalid
 */
export const fetchUserWorkspaces = async (userId: string): Promise<Workspace[]> => {
    try {
        const { request } = useRequest();
        const result = await request("GET", `/user/Categories/${userId}`);
        console.log("result", result);
        return result;
    } catch (error) {
        // Log the error for debugging
        console.error("Failed to fetch workspaces:", error.message);
        showToast("Failed to fetch workspaces. Please try again later. " + userId, "danger");
        // Re-throw with a more user-friendly message
        throw new Error("Failed to fetch workspaces. Please try again later.");
    }
};
