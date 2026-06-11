import baseClient from "./client";
import type { paths } from "./generated/types";
import { createLogger } from "@/utils/logger";
import { resolvePlayableVideo, type MediaItem } from "./media";

const logger = createLogger('UploadAPI');

type GenerateImageUploadURLResponse =
    paths["/v1/uploads/{resource_type}/{resource_id}/url"]["get"]["responses"]["200"]["content"]["application/json"];
type ConfirmImageUploadResponse =
    paths["/v1/uploads/{resource_type}/{resource_id}/confirm"]["post"]["responses"]["200"]["content"]["application/json"];

export interface ProfilePictureUploadResult {
    uploadUrl: string;
    publicUrl: string;
    key: string;
}

export interface ImageUploadResult {
    public_url: string;
    width: number;
    height: number;
    size: number; // bytes
    format?: string;
    processed_at?: string;
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
        case "mp4":
            return "video/mp4";
        case "mov":
        case "qt":
            return "video/quicktime";
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
        logger.debug("Requesting presigned upload URL");
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
        logger.debug("Converting image to blob");
        const response = await fetch(imageUri);
        if (!response.ok) {
            throw new Error("Failed to fetch image from URI");
        }
        const imageBlob = await response.blob();

        // Step 3: Upload the image to Digital Ocean Spaces using the presigned URL
        logger.debug("Uploading image to Spaces");
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
        logger.info("Upload successful");

        // Step 4: Confirm the upload with your backend
        logger.debug("Confirming upload with backend");
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
        logger.info("Upload confirmed");

        // Step 5: Return the public URL
        logger.info("Image available", { url: public_url });
        return public_url;
    } catch (error) {
        logger.error("Profile picture upload failed", error);
        throw error;
    }
}

/**
 * Upload a profile picture using smart processing (recommended)
 * @param userId - The user ID
 * @param imageUri - The local URI of the selected image
 * @returns Promise with the public URL of the uploaded image
 */
export async function uploadProfilePictureSmart(userId: string, imageUri: string): Promise<string> {
    const result = await uploadImageSmart("profile", userId, imageUri, { variant: "medium" });
    return typeof result === 'string' ? result : result.public_url;
}

/**
 * Upload and process an image using the backend processing system
 * @param resourceType - The type of resource (e.g., "blueprint", "profile", "post")
 * @param resourceId - The ID of the resource
 * @param imageUri - The local URI of the selected image
 * @param variant - The processing variant (thumbnail, medium, large, original)
 * @returns Promise with the public URL of the processed image
 */
export async function uploadAndProcessImage(
    resourceType: string,
    resourceId: string,
    imageUri: string,
    variant: string = "medium"
): Promise<ImageUploadResult> {
    try {
        // Step 1: Convert image URI to base64
        logger.debug("Converting image to base64");
        const response = await fetch(imageUri);
        if (!response.ok) {
            throw new Error("Failed to fetch image from URI");
        }

        const imageBlob = await response.blob();
        const base64Data = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const result = reader.result as string;
                // Remove data:image/jpeg;base64, prefix
                const base64 = result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(imageBlob);
        });

        // Determine content type from blob
        const contentType = imageBlob.type || getMimeTypeFromUri(imageUri);

        // Step 2: Send to processing endpoint
        logger.debug("Processing and uploading image");
        const { data: processData, error: processError } = await baseClient.POST(
            "/v1/uploads/{resource_type}/{resource_id}/process",
            {
                params: {
                    path: {
                        resource_type: resourceType,
                        resource_id: resourceId,
                    },
                    query: { variant },
                },
                body: {
                    image_data: base64Data,
                    content_type: contentType,
                },
            }
        );

        if (processError) {
            throw new Error(`Failed to process image: ${JSON.stringify(processError)}`);
        }

        logger.info("Image processed successfully", processData);
        return {
            public_url: processData.public_url,
            width: processData.width,
            height: processData.height,
            size: processData.size,
            format: processData.format,
            processed_at: processData.processed_at
        };
    } catch (error) {
        logger.error("Image processing failed", error);
        throw error;
    }
}

/**
 * Upload a generic image using the backend upload system (legacy method)
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
        logger.debug("Requesting presigned upload URL");
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
        logger.debug("Converting image to blob");
        const response = await fetch(imageUri);
        if (!response.ok) {
            throw new Error("Failed to fetch image from URI");
        }
        const imageBlob = await response.blob();

        // Step 3: Upload the image to Digital Ocean Spaces using the presigned URL
        logger.debug("Uploading image to Spaces");
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
        logger.info("Upload successful");

        // Step 4: Confirm the upload with your backend
        logger.debug("Confirming upload with backend");
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
        logger.info("Upload confirmed");

        // Step 5: Return the public URL
        logger.info("Image available", { url: public_url });
        return public_url;
    } catch (error) {
        logger.error("Image upload failed", error);
        throw error;
    }
}

/**
 * Smart image upload that automatically processes images for optimal performance
 * @param resourceType - The type of resource (e.g., "blueprint", "profile", "post")
 * @param resourceId - The ID of the resource
 * @param imageUri - The local URI of the selected image
 * @param options - Upload options
 * @returns Promise with the public URL of the uploaded image
 */
export async function uploadImageSmart(
    resourceType: string,
    resourceId: string,
    imageUri: string,
    options: {
        variant?: 'thumbnail' | 'medium' | 'large' | 'original';
        fallbackToLegacy?: boolean;
        returnFullResult?: boolean;
    } = {}
): Promise<string | ImageUploadResult> {
    const { variant, fallbackToLegacy = true, returnFullResult = false } = options;

    try {
        // Determine optimal variant based on resource type
        let selectedVariant = variant;
        if (!selectedVariant) {
            switch (resourceType) {
                case 'profile':
                    selectedVariant = 'medium';
                    break;
                case 'post':
                    selectedVariant = 'large';
                    break;
                case 'blueprint':
                    selectedVariant = 'large';
                    break;
                default:
                    selectedVariant = 'medium';
            }
        }

        // Try the new processing endpoint first
        try {
            const result = await uploadAndProcessImage(resourceType, resourceId, imageUri, selectedVariant);
            return returnFullResult ? result : result.public_url;
        } catch (processingError) {
            logger.warn("Processing upload failed, falling back to legacy upload", processingError);

            if (!fallbackToLegacy) {
                throw processingError;
            }

            // Fallback to legacy upload
            const fileType = getMimeTypeFromUri(imageUri);
            const legacyUrl = await uploadImage(resourceType, resourceId, imageUri, fileType);

            // For legacy uploads, we don't have size info, so return just the URL or a basic result
            if (returnFullResult) {
                return {
                    public_url: legacyUrl,
                    width: 0, // Unknown for legacy uploads
                    height: 0, // Unknown for legacy uploads
                    size: 0 // Unknown for legacy uploads
                };
            }
            return legacyUrl;
        }
    } catch (error) {
        logger.error("Smart upload failed", error);
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
    const result = await uploadImageSmart("blueprint", blueprintId, imageUri, { variant: "large" });
    return typeof result === 'string' ? result : result.public_url;
}

export const VIDEO_MAX_BYTES = 100 * 1024 * 1024; // 100MB
export const VIDEO_MAX_DURATION_MS = 60_000; // 60s

// Kudos videos are quick cheers — half the post limits.
// Must stay in sync with KudosVideoMaxDurationMs in backend/internal/handlers/types/types.go.
export const KUDOS_VIDEO_MAX_BYTES = 50 * 1024 * 1024; // 50MB
export const KUDOS_VIDEO_MAX_DURATION_MS = 30_000; // 30s

export type UploadVideoOptions = {
    /** Byte cap applied to the file actually uploaded. Defaults to the post limit. */
    maxBytes?: number;
    /** Known clip length, threaded onto the returned MediaItem. */
    durationMs?: number;
};

/**
 * Compress a video on-device (~720p H.264), generate a thumbnail, and upload both.
 * Returns a MediaItem for inclusion in a post's media[].
 */
export async function uploadVideo(
    resourceType: string,
    resourceId: string,
    videoUri: string,
    options: UploadVideoOptions = {}
): Promise<MediaItem> {
    // Lazy-load native modules so merely importing this file never crashes the
    // app in a build that hasn't been prebuilt with these native deps.
    const { Video: VideoCompressor } = require("react-native-compressor");
    const VideoThumbnails = require("expo-video-thumbnails");

    // 1. Compress aggressively before upload. If compression itself fails, keep the original.
    let compressedUri = videoUri;
    try {
        compressedUri = await VideoCompressor.compress(videoUri, {
            compressionMethod: "manual",
            maxSize: 720,
            bitrate: 2_000_000, // ~2 Mbps, lightweight for phone-feed playback
        });
    } catch (err) {
        logger.warn("Video compression failed; uploading original", err);
    }

    // 2. Pick the file we can actually play. The iOS Simulator has no real H.264 encoder,
    //    so the compressed output can be unopenable; thumbnail generation validates it and
    //    falls back to the original (valid) file when needed. On a real device the
    //    compressed file is valid and is used.
    const { uploadUri, thumb } = await resolvePlayableVideo(videoUri, compressedUri, (uri) =>
        VideoThumbnails.getThumbnailAsync(uri, { time: 0, quality: 0.7 })
    );

    // 3. Enforce size cap on the file we'll actually upload.
    const maxBytes = options.maxBytes ?? VIDEO_MAX_BYTES;
    const blob = await fetch(uploadUri).then((r) => r.blob());
    if (blob.size > maxBytes) {
        throw new Error("Video is too large after compression. Please pick a shorter clip.");
    }

    // 4. Upload the thumbnail via the existing image flow.
    const thumbResult = (await uploadImageSmart(resourceType, resourceId, thumb.uri, {
        variant: "large",
        returnFullResult: true,
    })) as ImageUploadResult;

    // 5. Upload the validated video via presigned PUT (mp4 from the compressor, or the
    //    original's type — e.g. video/quicktime — when we fell back to it). Default to
    //    video/mp4 if the uri has no recognizable video extension.
    const detectedType = getMimeTypeFromUri(uploadUri);
    const videoType = detectedType.startsWith("video/") ? detectedType : "video/mp4";
    const videoUrl = await uploadImage(resourceType, resourceId, uploadUri, videoType);

    return {
        type: "video",
        url: videoUrl,
        thumbnailUrl: thumbResult.public_url,
        width: thumb.width || thumbResult.width || 0,
        height: thumb.height || thumbResult.height || 0,
        bytes: blob.size,
        durationMs: options.durationMs,
    };
}
