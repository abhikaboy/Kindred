import { client } from "@/hooks/useTypedAPI";
import createClient from "openapi-fetch";
import type { paths, components } from "./generated/types";
import * as SecureStore from "expo-secure-store";

// Create a separate client ONLY for posts that points to local backend
const createLocalPostsClient = () => {
    // For iOS Simulator, use your computer's IP instead of 127.0.0.1
    // To find your IP: run `ipconfig getifaddr en0` (Mac) or `hostname -I` (Linux)
    const localUrl = __DEV__ ? 
        "http://192.168.0.16:8080" : // Replace with your actual IP address
        "http://127.0.0.1:8080";
        
    console.log("🔧 LOCAL POSTS CLIENT: Using URL:", localUrl);
    
    const localClient = createClient<paths>({
        baseUrl: localUrl,
    });

    // Add the same auth interceptor as your main client
    localClient.use({
        async onRequest({ request }) {
            console.log("🔧 LOCAL POSTS: Making request to:", request.url);

            try {
                const authData = await SecureStore.getItemAsync("auth_data");
                
                if (authData) {
                    const parsed = JSON.parse(authData);
                    const { access_token, refresh_token } = parsed;

                    if (access_token) {
                        request.headers.set("Authorization", `Bearer ${access_token}`);
                        console.log("🔧 LOCAL POSTS: Added auth token");
                    }

                    if (refresh_token) {
                        request.headers.set("refresh_token", refresh_token);
                    }
                }
            } catch (error) {
                console.error("Error retrieving auth data:", error);
            }

            request.headers.set("Content-Type", "application/json");
            return request;
        },

        async onResponse({ response, request }) {
            console.log(`🔧 LOCAL POSTS: Response ${response.status} for ${request.url}`);
            return response;
        },
    });

    return localClient;
};

// Get the local client for posts
const localPostsClient = createLocalPostsClient();

// Helper to inject auth headers for regular client
const withAuthHeaders = (params: any = {}) => ({
    ...params,
    header: { Authorization: "", ...(params.header || {}) },
});

type PostDocument = components["schemas"]["PostDocument"];
type CreatePostParams = components["schemas"]["CreatePostParams"];
type CommentDocument = components["schemas"]["CommentDocument"];

// Remove UpdatePostDocument since it doesn't exist in your generated types

/**
 * @param images
 * @param caption 
 * @param taskReference 
 * @param blueprintId 
 * @param isPublic 
 * @returns 
 */
export async function createPostToBackend(
    images: string[], 
    caption: string, 
    taskReference?: { id: any; content: any; category: { id: any; name: any; }; }, 
    blueprintId?: string, 
    isPublic: boolean = false
) {
    try {
        const result = await createPost(images, caption, taskReference, blueprintId, isPublic);
        return result;
    } catch (error) {
        console.log(`Failed to create post to backend: ${JSON.stringify(error)}`);
    }
}


/**
 * 
 * @returns 
 */
export async function getPostsFromBackend() {
    try {
        const result = await getAllPosts();
        return result;
    } catch (error) {
        console.log(`Failed to get all posts from backend: ${JSON.stringify(error)}`);
    }
}


/**
 * 
 * @param images 
 * @param caption 
 * @param taskReference 
 * @param blueprintId 
 * @param isPublic 
 * @returns 
 */
export const createPost = async (
    images: string[],
    caption: string,
    taskReference?: any,
    blueprintId?: string,
    isPublic: boolean = true
): Promise<PostDocument> => {    
    const { data, error } = await localPostsClient.POST("/v1/user/posts", {
        params: withAuthHeaders({}),
        body: { 
            images, 
            caption, 
            task: taskReference,  
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
 * 
 * @returns 
 */
export const getAllPosts = async (): Promise<PostDocument[]> => {
    const { data, error } = await localPostsClient.GET("/v1/user/posts", {
        params: withAuthHeaders({}),
    });

    if (error) {
        throw new Error(`Failed to get posts: ${JSON.stringify(error)}`);
    }

    return data || [];
};

/**
 * Get Post by Id 
 * @param postId 
 * @returns 
 */
export const getPostById = async (postId: string): Promise<PostDocument> => {
    const { data, error } = await localPostsClient.GET("/v1/user/posts/{id}", {
        params: withAuthHeaders({ path: { id: postId } }),
    });

    if (error) {
        throw new Error(`Failed to get post: ${JSON.stringify(error)}`);
    }

    return data;
};



export const addComment = async (
    postId: string, 
    content: string, 
    parentId?: string
): Promise<CommentDocument> => {
  
    if (!postId) {
        throw new Error("PostId is required");
    }
    
    if (typeof postId !== 'string') {
        throw new Error(`PostId must be string, got ${typeof postId}`);
    }
    
    const cleanPostId = postId.trim();
    const objectIdRegex = /^[0-9a-fA-F]{24}$/;
    if (!objectIdRegex.test(cleanPostId)) {
        throw new Error(`Invalid post ID format: ${cleanPostId}`);
    }
        
    const { data, error } = await localPostsClient.POST("/v1/user/posts/{postId}/comment", {
        params: { path: { postId: cleanPostId } }, 
        body: { 
            content,
            parentId 
        },
    });
    if (error) {
        throw new Error(`Failed to add comment: ${JSON.stringify(error)}`);
    }
    
    if (data && typeof data === 'object') {
        if ('comment' in data) {
            const comment = (data as any).comment as CommentDocument;
            return comment;
        }
    }
    
    throw new Error("Invalid API response structure");
};