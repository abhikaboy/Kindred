import { Categories, Workspace } from "./types";
import { useRequest } from "@/hooks/useRequest";

/**
 * Creates a new workspace
 * API: Makes POST request to create a new workspace with a proxy category
 * Frontend: The response is used to update the workspaces state in TaskContext
 * Note: Uses a special "!-proxy-!" category name as a placeholder
 * @param name - The name of the workspace to create
 */
export const createWorkspace = async (name: string): Promise<Categories> => {
    const { request } = useRequest();
    return await request("POST", `/user/categories`, {
        name: "!-proxy-!",
        workspaceName: name,
    });
};

/**
 * Fetches all workspaces for a user
 * API: Makes GET request to fetch workspaces from backend
 * Frontend: Data is used to update workspaces state in TaskContext
 * @param userId - The ID of the user whose workspaces to fetch
 */
export const fetchUserWorkspaces = async (userId: string): Promise<Workspace[]> => {
    const { request } = useRequest();
    return await request("GET", `/user/Categories/${userId}`);
};
