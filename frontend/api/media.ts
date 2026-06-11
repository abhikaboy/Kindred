import type { components } from "./generated/types";

export type MediaItem = components["schemas"]["MediaItem"];

export type PickedMedia = {
    uri: string;
    type: "image" | "video";
};

const VIDEO_EXTS = ["mp4", "mov", "m4v", "qt"];

export function mediaTypeFromUri(uri: string): "image" | "video" {
    const ext = uri.split(".").pop()?.toLowerCase() ?? "";
    return VIDEO_EXTS.includes(ext) ? "video" : "image";
}

/** Normalize expo-image-picker assets into typed picked media, preserving order. */
export function assetsToPickedMedia(
    assets: { uri: string; type?: "image" | "video" }[]
): PickedMedia[] {
    return assets.map((a) => ({
        uri: a.uri,
        type: a.type ?? mediaTypeFromUri(a.uri),
    }));
}

export type VideoThumb = { uri: string; width: number; height: number };

/**
 * Choose the video file we can actually play. Prefer the compressed output, but the
 * iOS Simulator has no real H.264 encoder, so react-native-compressor can emit a file
 * that exists yet won't open in AVFoundation ("Cannot Open"). Thumbnail generation
 * doubles as a validity check: if the compressed file can't be opened, fall back to the
 * original (which expo-image-picker guarantees is a valid movie). Returns the usable
 * upload uri plus its thumbnail. `getThumbnail` is injected so this stays unit-testable.
 */
export async function resolvePlayableVideo(
    originalUri: string,
    compressedUri: string,
    getThumbnail: (uri: string) => Promise<VideoThumb>
): Promise<{ uploadUri: string; thumb: VideoThumb }> {
    try {
        const thumb = await getThumbnail(compressedUri);
        return { uploadUri: compressedUri, thumb };
    } catch (compressedErr) {
        // No fallback possible if compression was skipped (same file) — surface the error.
        if (originalUri === compressedUri) throw compressedErr;
        const thumb = await getThumbnail(originalUri);
        return { uploadUri: originalUri, thumb };
    }
}
