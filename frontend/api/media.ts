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
