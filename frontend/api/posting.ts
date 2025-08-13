import { client } from "@/hooks/useTypedAPI"; 
import type { paths, components } from "./generated/types";

// Helper to inject auth headers that will be overridden by middleware
const withAuthHeaders = (params: any = {}) => ({
    ...params,
    header: { Authorization: "", ...(params.header || {}) },
});

type PostDocument = components["schemas"]["PostDocument"];
type CreatePostParams = components["schemas"]["CreatePostParams"];
type UpdatePostDocument = components["schemas"]["UpdatePostDocument"];

// Manual types for comment/reaction functionality (not in generated schema yet)
interface CommentDocument {
    id: string;
    userId: string;
    content: string;
    createdAt: string;
    updatedAt: string;
    parentId?: string;
}

interface AddCommentParams {
    content: string;
    parentId?: string;
}

interface AddReactionParams {
    emoji: string;
}

/**
 * Create post to backend 
 * @param images 
 * @param caption 
 * @param categoryId 
 * @param taskId 
 * @param blueprintId 
 * @param isPublic 
 * @returns 
 */
export async function createPostToBackend(
    images: string[],
    caption: string,
    categoryId?: string,
    taskId?: string,
    blueprintId?: string,
    isPublic: boolean = true
) {
    try {
        const result = await createPost(images, caption, categoryId, taskId, blueprintId, isPublic);
        console.log("Post created successfully:", result);
        return result;
    } catch (error) {
        console.error("Failed to create post:", error);
        throw error;
    }
}

/**
 * Get all posts from backend
 * @returns 
 */
export async function getPostsFromBackend() {
    try {
        const result = await getAllPosts();
        console.log("Posts retrieved successfully:", result);
        return result;
    } catch (error) {
        console.error("Failed to get posts:", error);
        throw error;
    }
}

/**
 * Get post by ID from backend
 * @param postId 
 * @returns 
 */
export async function getPostByIdFromBackend(postId: string) {
    try {
        const result = await getPostById(postId);
        console.log("Post retrieved successfully:", result);
        return result;
    } catch (error) {
        console.error("Failed to get post:", error);
        throw error;
    }
}

/**
 * Creates a new post
 * @param images 
 * @param caption 
 * @param categoryId 
 * @param taskId 
 * @param blueprintId 
 * @param isPublic 
 * @returns 
 */
export const createPost = async (
    images: string[],
    caption: string,
    categoryId?: string,
    taskId?: string,
    blueprintId?: string,
    isPublic: boolean = true
): Promise<PostDocument> => {
    const { data, error } = await client.POST("/v1/user/posts", {
        params: withAuthHeaders({}),
        body: { 
            images, 
            caption, 
            categoryId, 
            taskId, 
            blueprintId, 
            isPublic 
        },
    });

    if (error) {
        throw new Error(`Failed to create post: ${JSON.stringify(error)}`);
    }

    return data;
};

/**
 * Get all posts
 * @returns 
 */
export const getAllPosts = async (): Promise<PostDocument[]> => {
    const { data, error } = await client.GET("/v1/user/posts", {
        params: withAuthHeaders({}),
    });

    if (error) {
        throw new Error(`Failed to get posts: ${JSON.stringify(error)}`);
    }

    return data || [];
};

/**
 * Get post by ID
 * @param postId 
 * @returns 
 */
export const getPostById = async (postId: string): Promise<PostDocument> => {
    const { data, error } = await client.GET("/v1/user/posts/{id}", {
        params: withAuthHeaders({ path: { id: postId } }),
    });

    if (error) {
        throw new Error(`Failed to get post: ${JSON.stringify(error)}`);
    }

    return data;
};