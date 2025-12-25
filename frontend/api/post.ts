import { client } from "@/hooks/useTypedAPI";
import type { paths, components } from "./generated/types";

// Helper to inject auth headers that will be overridden by middleware
const withAuthHeaders = (params: any = {}) => ({
    ...params,
    header: { Authorization: "", ...(params.header || {}) },
});

// Extract the type definitions from the generated types
type PostDocument = components["schemas"]["PostDocument"];
type PostDocumentAPI = components["schemas"]["PostDocumentAPI"];
type CreatePostParams = components["schemas"]["CreatePostParams"];
type CommentDocument = components["schemas"]["CommentDocument"];
type CommentDocumentAPI = components["schemas"]["CommentDocumentAPI"];

// Export Post type for use in other files
export type Post = PostDocumentAPI;

/**
 * Create a new post
 * @param images 
 * @param caption
 * @param taskReference 
 * @param blueprintId 
 * @param isPublic
 * @param size
 * @param groups - Array of group IDs to share the post with
 * @param dual - Optional front-facing camera image URL for dual camera posts
 */
export const createPost = async (
    images: string[],
    caption: string,
    taskReference?: { id: any; content: any; category: { id: any; name: any; }; },
    blueprintId?: string,
    isPublic: boolean = true,
    size?: { width: number; height: number; bytes: number },
    groups?: string[],
    dual?: string
): Promise<{ post: PostDocumentAPI; userStats: { posts_made: number; points: number } | null }> => {    
    const { data, error } = await client.POST("/v1/user/posts", {
        params: withAuthHeaders({}),
        body: { 
            images, 
            caption, 
            task: taskReference,  
            blueprintId, 
            isPublic,
            size,
            groups,
            dual
        },
    });

    if (error) {
        throw new Error(`Failed to create post: ${JSON.stringify(error)}`);
    }

    return {
        post: (data as any).body || data,
        userStats: (data as any).user_stats || null
    };
};

/**
 * Response type for paginated posts
 */
export interface PaginatedPostsResponse {
    posts: PostDocumentAPI[];
    total: number;
    hasMore: boolean;
    nextOffset: number;
}

/**
 * Get all posts with pagination
 * @param limit - Number of posts to return (default: 8)
 * @param offset - Number of posts to skip (default: 0)
 */
export const getAllPosts = async (limit: number = 8, offset: number = 0): Promise<PaginatedPostsResponse> => {
    const { data, error } = await client.GET("/v1/user/posts", {
        params: withAuthHeaders({
            query: { limit, offset }
        }),
    });

    if (error) {
        throw new Error(`Failed to get posts: ${JSON.stringify(error)}`);
    }
    
    // @ts-ignore - OpenAPI types not yet regenerated with pagination fields
    return {
        posts: data?.posts || [],
        // @ts-ignore
        total: data?.total || 0,
        // @ts-ignore
        hasMore: data?.hasMore || false,
        // @ts-ignore
        nextOffset: data?.nextOffset || 0,
    };
};

/**
 * Get friends posts (chronologically ordered) with pagination
 * @param limit - Number of posts to return (default: 8)
 * @param offset - Number of posts to skip (default: 0)
 */
export const getFriendsPosts = async (limit: number = 8, offset: number = 0): Promise<PaginatedPostsResponse> => {
    const { data, error } = await client.GET("/v1/user/posts/friends", {
        params: withAuthHeaders({
            query: { limit, offset }
        }),
    });

    if (error) {
        throw new Error(`Failed to get friends posts: ${JSON.stringify(error)}`);
    }
    
    // @ts-ignore - OpenAPI types not yet regenerated with pagination fields
    return {
        posts: data?.posts || [],
        // @ts-ignore
        total: data?.total || 0,
        // @ts-ignore
        hasMore: data?.hasMore || false,
        // @ts-ignore
        nextOffset: data?.nextOffset || 0,
    };
};

/**
 * Get unified feed (posts and activities from friends)
 * @param limit - Number of feed items to return (default: 20)
 * @param offset - Number of feed items to skip (default: 0)
 */
export interface FeedTask {
    id: string;
    content: string;
    priority: number;
    value: number;
    public: boolean;
    timestamp: string;
    categoryId: string;
    categoryName: string;
    workspaceName: string;
    user: {
        _id: string;
        handle: string;
        display_name: string;
        profile_picture: string;
    };
}

export interface FeedItem {
    type: 'post' | 'task';
    post?: Post;
    task?: FeedTask;
}

export interface PaginatedFeedResponse {
    items: FeedItem[];
    total: number;
    hasMore: boolean;
    nextOffset: number;
}

export const getFeed = async (limit: number = 20, offset: number = 0): Promise<PaginatedFeedResponse> => {
    // @ts-ignore - New endpoint not yet in OpenAPI spec
    const { data, error } = await client.GET("/v1/user/feed", {
        params: withAuthHeaders({
            query: { limit, offset }
        }),
    });

    if (error) {
        throw new Error(`Failed to get feed: ${JSON.stringify(error)}`);
    }
    
    // @ts-ignore - OpenAPI types not yet regenerated
    return {
        // @ts-ignore
        items: data?.items || [],
        // @ts-ignore
        total: data?.total || 0,
        // @ts-ignore
        hasMore: data?.hasMore || false,
        // @ts-ignore
        nextOffset: data?.nextOffset || 0,
    };
};

/**
 * Get post by ID
 * @param postId
 */
export const getPostById = async (postId: string): Promise<PostDocumentAPI> => {
    const { data, error } = await client.GET("/v1/user/posts/{id}", {
        params: withAuthHeaders({ path: { id: postId } }),
    });

    if (error) {
        throw new Error(`Failed to get post: ${JSON.stringify(error)}`);
    }

    return data;
};


/**
 * Get user's posts
 * @param userId 
 */
export const getUserPosts = async (userId: string): Promise<PostDocument[]> => {
    // @ts-ignore - Path updated to /v1/user/{userId}/posts but OpenAPI spec needs regeneration
    const { data, error } = await client.GET("/v1/user/{userId}/posts", {
        params: withAuthHeaders({ path: { userId } }),
    });

    if (error) {
        throw new Error(`Failed to get user posts: ${JSON.stringify(error)}`);
    }

    // @ts-ignore - Backend returns { body: PostDocument[] } (lowercase b per JSON tag)
    return data || [] 
};

/**
 * Add comment to post
 * @param postId 
 * @param content 
 * @param parentId 
 */
export const addComment = async (
    postId: string, 
    content: string, 
    parentId?: string
): Promise<CommentDocumentAPI> => {
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
        
    const { data, error } = await client.POST("/v1/user/posts/{postId}/comment", {
        params: withAuthHeaders({path: { postId: cleanPostId }}), 
        body: { 
            content,
            parentId 
        },
    });
    
    if (error) {
        throw new Error(`Failed to add comment: ${JSON.stringify(error)}`);
    }
    
    if (data && typeof data === 'object' && 'comment' in data) {
        return (data as any).comment as CommentDocumentAPI;
    }
    
    throw new Error("Invalid API response structure");
};

/**
 * Delete comment from post
 * @param postId 
 * @param commentId 
 */
export const deleteComment = async (postId: string, commentId: string): Promise<void> => {
    const { error } = await client.DELETE("/v1/user/posts/{postId}/comment/{commentId}", {
        params: withAuthHeaders({ 
            path: {
                postId,
                commentId
            },
        }),
    });

    if (error) {
        throw new Error(`Failed to delete comment: ${JSON.stringify(error)}`);
    }
};

/**
 * Toggle reaction on post
 * @param postId 
 * @param emoji
 */
export const toggleReaction = async (
    postId: string, 
    emoji: string
): Promise<{ added: boolean; message: string }> => {
    // Validate inputs
    if (!postId) {
        throw new Error("PostId is required");
    }
    
    if (!emoji || typeof emoji !== 'string') {
        throw new Error("Emoji is required and must be a string");
    }
    
    const cleanPostId = postId.trim();
    const objectIdRegex = /^[0-9a-fA-F]{24}$/;
    if (!objectIdRegex.test(cleanPostId)) {
        throw new Error(`Invalid post ID format: ${cleanPostId}`);
    }
        
    const { data, error } = await client.POST("/v1/user/posts/{postId}/reaction", {
        params: withAuthHeaders({ path: { postId: cleanPostId } }), 
        body: { 
            emoji: emoji.trim()
        },
    });
    
    if (error) {
        throw new Error(`Failed to toggle reaction: ${JSON.stringify(error)}`);
    }
    
    if (data && typeof data === 'object' && 'added' in data && 'message' in data) {
        return data as { added: boolean; message: string };
    }
    
    throw new Error("Invalid API response structure");
};

/**
 * Delete post
 * @param postId 
 */
export const deletePost = async (postId: string): Promise<void> => {
    const { error } = await client.DELETE("/v1/user/posts/{id}", {
        params: withAuthHeaders({ path: { id: postId } }),
    });

    if (error) {
        throw new Error(`Failed to delete post: ${JSON.stringify(error)}`);
    }
};

/**
 * Update post
 * @param postId 
 * @param caption 
 * @param isPublic 
 * @param size 
 */
export const updatePost = async (
    postId: string, 
    caption?: string, 
    isPublic?: boolean,
    size?: { width: number; height: number; bytes: number }
): Promise<void> => {
    const { error } = await client.PATCH("/v1/user/posts/{id}", {
        params: withAuthHeaders({ path: { id: postId } }),
        body: { caption, isPublic, size },
    });

    if (error) {
        throw new Error(`Failed to update post: ${JSON.stringify(error)}`);
    }
};


export const createPostToBackend = async (
    images: string[], 
    caption: string, 
    taskReference?: { id: any; content: any; category: { id: any; name: any; }; }, 
    blueprintId?: string, 
    isPublic: boolean = false,
    size?: { width: number; height: number; bytes: number },
    groups?: string[],
    dual?: string
): Promise<{ post: PostDocumentAPI; userStats: { posts_made: number; points: number } | null }> => {
    try {
        const result = await createPost(images, caption, taskReference, blueprintId, isPublic, size, groups, dual);
        return result;
    } catch (error) {
        console.log(`Failed to create post to backend: ${JSON.stringify(error)}`);
        throw error;
    }
};

export const getPostsFromBackend = async (limit: number = 8, offset: number = 0) => {
    try {
        const result = await getAllPosts(limit, offset);
        return result;
    } catch (error) {
        console.log(`Failed to get all posts from backend: ${JSON.stringify(error)}`);
        throw error;
    }
};

export const addReaction = async (postId: string, emoji: string) => {
    return await toggleReaction(postId, emoji);
};

export const getPostsByBlueprint = async (blueprintId: string): Promise<PostDocumentAPI[]> => {
    const response = await client.GET("/v1/user/posts/blueprint/{blueprintId}", {
        params: {
            path: { blueprintId },
            header: { Authorization: "" }
        }
    });
    
    if (response.error) {
        console.error("Error fetching posts by blueprint:", response.error);
        throw new Error("Failed to fetch posts by blueprint");
    }
    
    return response.data?.posts || [];
};