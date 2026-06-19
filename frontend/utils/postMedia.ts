import type { MediaItem } from "@/api/media";

export interface PostCover {
    url: string;
    isVideo: boolean;
}

// A post-like shape from the posts API. media[] is the source of truth (the
// backend backfills it from images[]); images[] is the legacy fallback.
interface CoverablePost {
    media?: MediaItem[] | null;
    images?: string[] | null;
}

// The grid cover is the first media item we can show as a still: videos render
// their uploaded poster (thumbnailUrl), images render directly. A posterless
// video is skipped so a later image can still cover the post.
export function postCover(post: CoverablePost): PostCover | null {
    for (const m of post.media ?? []) {
        if (m.type === "video") {
            if (m.thumbnailUrl) return { url: m.thumbnailUrl, isVideo: true };
        } else if (m.url) {
            return { url: m.url, isVideo: false };
        }
    }
    if (post.images && post.images.length > 0) {
        return { url: post.images[0], isVideo: false };
    }
    return null;
}
