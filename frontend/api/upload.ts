import baseClient from "./client";
import type { paths } from "./generated/types";

type GenerateImageUploadURLResponse =
    paths["/v1/uploads/{resource_type}/{resource_id}/url"]["get"]["responses"]["200"]["content"]["application/json"];
type ConfirmImageUploadResponse =
    paths["/v1/uploads/{resource_type}/{resource_id}/confirm"]["post"]["responses"]["200"]["content"]["application/json"];

export interface ProfilePictureUploadResult {
    uploadUrl: string;
    publicUrl: string;
    key: string;
}

/**
 * Get MIME type from file URI
 */
export function getMimeTypeFromUri(uri: string): string {
    const extension = uri.split(".").pop()?.toLowerCase();
    switch (extension) {
        case "jpg":
        case "jpeg":
            return "image/jpeg";
        case "png":
            return "image/png";
        case "gif":
            return "image/gif";
        case "webp":
            return "image/webp";
        default:
            return "image/jpeg"; // default fallback
    }
}

/**
 * Upload a profile picture using the backend upload system
 * @param userId - The user ID
 * @param imageUri - The local URI of the selected image
 * @param fileType - The MIME type of the image (e.g., "image/jpeg")
 * @returns Promise with the public URL of the uploaded image
 */
export async function uploadProfilePicture(userId: string, imageUri: string, fileType: string): Promise<string> {
    try {
        // Step 1: Get presigned upload URL from backend
        console.log("Requesting presigned upload URL...");
        const { data: presignData, error: presignError } = await baseClient.GET(
            "/v1/uploads/{resource_type}/{resource_id}/url",
            {
                params: {
                    path: {
                        resource_type: "profile",
                        resource_id: userId,
                    },
                    query: { file_type: fileType },
                },
            }
        );

        if (presignError) {
            throw new Error(`Failed to get presigned upload URL: ${JSON.stringify(presignError)}`);
        }

        const { upload_url, public_url } = presignData;

        // Step 2: Convert image URI to blob/buffer
        console.log("Converting image to blob...");
        const response = await fetch(imageUri);
        if (!response.ok) {
            throw new Error("Failed to fetch image from URI");
        }
        const imageBlob = await response.blob();

        // Step 3: Upload the image to Digital Ocean Spaces using the presigned URL
        console.log("Uploading image to Spaces...");
        const uploadResponse = await fetch(upload_url, {
            method: "PUT",
            body: imageBlob,
            headers: {
                "Content-Type": fileType,
                "x-amz-acl": "public-read",
            },
        });

        if (!uploadResponse.ok) {
            throw new Error(`Failed to upload image to Spaces: ${uploadResponse.status} ${uploadResponse.statusText}`);
        }
        console.log("Upload successful!");

        // Step 4: Confirm the upload with your backend
        console.log("Confirming upload with backend...");
        const { error: confirmError } = await baseClient.POST("/v1/uploads/{resource_type}/{resource_id}/confirm", {
            params: {
                path: {
                    resource_type: "profile",
                    resource_id: userId,
                },
            },
            body: { public_url },
        });

        if (confirmError) {
            throw new Error(`Failed to confirm upload: ${JSON.stringify(confirmError)}`);
        }
        console.log("Upload confirmed!");

        // Step 5: Return the public URL
        console.log("Image is now available at:", public_url);
        return public_url;
    } catch (error) {
        console.error("Profile picture upload failed:", error);
        throw error;
    }
}

/**
 * Upload a generic image using the backend upload system
 * @param resourceType - The type of resource (e.g., "blueprint", "profile", "post")
 * @param resourceId - The ID of the resource
 * @param imageUri - The local URI of the selected image
 * @param fileType - The MIME type of the image (e.g., "image/jpeg")
 * @returns Promise with the public URL of the uploaded image
 */
export async function uploadImage(
    resourceType: string,
    resourceId: string,
    imageUri: string,
    fileType: string
): Promise<string> {
    try {
        // Step 1: Get presigned upload URL from backend
        console.log("Requesting presigned upload URL...");
        const { data: presignData, error: presignError } = await baseClient.GET(
            "/v1/uploads/{resource_type}/{resource_id}/url",
            {
                params: {
                    path: {
                        resource_type: resourceType,
                        resource_id: resourceId,
                    },
                    query: { file_type: fileType },
                },
            }
        );

        if (presignError) {
            throw new Error(`Failed to get presigned upload URL: ${JSON.stringify(presignError)}`);
        }

        const { upload_url, public_url } = presignData;

        // Step 2: Convert image URI to blob/buffer
        console.log("Converting image to blob...");
        const response = await fetch(imageUri);
        if (!response.ok) {
            throw new Error("Failed to fetch image from URI");
        }
        const imageBlob = await response.blob();

        // Step 3: Upload the image to Digital Ocean Spaces using the presigned URL
        console.log("Uploading image to Spaces...");
        const uploadResponse = await fetch(upload_url, {
            method: "PUT",
            body: imageBlob,
            headers: {
                "Content-Type": fileType,
                "x-amz-acl": "public-read",
            },
        });

        if (!uploadResponse.ok) {
            throw new Error(`Failed to upload image to Spaces: ${uploadResponse.status} ${uploadResponse.statusText}`);
        }
        console.log("Upload successful!");

        // Step 4: Confirm the upload with your backend
        console.log("Confirming upload with backend...");
        const { error: confirmError } = await baseClient.POST("/v1/uploads/{resource_type}/{resource_id}/confirm", {
            params: {
                path: {
                    resource_type: resourceType,
                    resource_id: resourceId,
                },
            },
            body: { public_url },
        });

        if (confirmError) {
            throw new Error(`Failed to confirm upload: ${JSON.stringify(confirmError)}`);
        }
        console.log("Upload confirmed!");

        // Step 5: Return the public URL
        console.log("Image is now available at:", public_url);
        return public_url;
    } catch (error) {
        console.error("Image upload failed:", error);
        throw error;
    }
}

/**
 * Upload a blueprint banner image using the backend upload system
 * @param blueprintId - The blueprint ID (can be a temporary ID for new blueprints)
 * @param imageUri - The local URI of the selected image
 * @param fileType - The MIME type of the image (e.g., "image/jpeg")
 * @returns Promise with the public URL of the uploaded image
 */
export async function uploadBlueprintBanner(blueprintId: string, imageUri: string, fileType: string): Promise<string> {
    return uploadImage("blueprint", blueprintId, imageUri, fileType);
}
