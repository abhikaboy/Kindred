import { client } from "@/hooks/useTypedAPI";
import type { paths, components } from "./generated/types";
import { withAuthHeaders } from "./utils";

// Extract the type definitions from the generated types
type PostDocument = components["schemas"]["PostDocument"];
type CreatePostParams = components["schemas"]["CreatePostParams"];
type UpdatePostDocument = components["schemas"]["UpdatePostDocument"];

/**
 * Get all posts for the authenticated user
 * API: Makes GET request to retrieve all posts
 * Frontend: Used to display posts in the feed
 */
export const getPostsAPI = async (): Promise<PostDocument[]> => {
    const { data, error } = await client.GET("/v1/user/posts", {
        params: withAuthHeaders(),
    });

    if (error) {
        throw new Error(`Failed to get posts: ${JSON.stringify(error)}`);
    }

    return data || [];
};

/**
 * Get a specific post by ID
 * API: Makes GET request to retrieve a specific post
 * Frontend: Used to display individual post details
 * @param id - The ID of the post to retrieve
 */
export const getPostByIdAPI = async (id: string): Promise<PostDocument> => {
    const { data, error } = await client.GET("/v1/user/posts/{id}", {
        params: withAuthHeaders({ path: { id } }),
    });

    if (error) {
        throw new Error(`Failed to get post: ${JSON.stringify(error)}`);
    }

    return data;
};

/**
 * Create a new post
 * API: Makes POST request to create a new post
 * Frontend: Used to create new posts
 * @param postData - The post data including field1, field2, and picture
 */
export const createPostAPI = async (postData: CreatePostParams): Promise<PostDocument> => {
    const { data, error } = await client.POST("/v1/user/posts", {
        params: withAuthHeaders(),
        body: postData,
    });

    if (error) {
        throw new Error(`Failed to create post: ${JSON.stringify(error)}`);
    }

    return data;
};

/**
 * Update an existing post
 * API: Makes PATCH request to update the post
 * Frontend: Used to edit existing posts
 * @param id - The ID of the post to update
 * @param postData - The updated post data
 */
export const updatePostAPI = async (id: string, postData: UpdatePostDocument): Promise<{ message: string }> => {
    const { data, error } = await client.PATCH("/v1/user/posts/{id}", {
        params: withAuthHeaders({ path: { id } }),
        body: postData,
    });

    if (error) {
        throw new Error(`Failed to update post: ${JSON.stringify(error)}`);
    }

    return data;
};

/**
 * Delete a post
 * API: Makes DELETE request to remove the post
 * Frontend: Used to delete posts
 * @param id - The ID of the post to delete
 */
export const deletePostAPI = async (id: string): Promise<{ message: string }> => {
    const { data, error } = await client.DELETE("/v1/user/posts/{id}", {
        params: withAuthHeaders({ path: { id } }),
    });

    if (error) {
        throw new Error(`Failed to delete post: ${JSON.stringify(error)}`);
    }

    return data;
};
