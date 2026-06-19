import { postCover } from "@/utils/postMedia";
import type { MediaItem } from "@/api/media";

const img = (url: string): MediaItem => ({ type: "image", url, width: 0, height: 0 }) as MediaItem;
const vid = (url: string, thumbnailUrl?: string): MediaItem =>
    ({ type: "video", url, thumbnailUrl, width: 0, height: 0 }) as MediaItem;

describe("postCover", () => {
    it("uses the first image's url for an image post", () => {
        expect(postCover({ media: [img("a.jpg"), img("b.jpg")] })).toEqual({ url: "a.jpg", isVideo: false });
    });

    it("uses a video's poster thumbnail and flags it as video", () => {
        expect(postCover({ media: [vid("clip.mp4", "poster.jpg")] })).toEqual({ url: "poster.jpg", isVideo: true });
    });

    it("falls back to legacy images[] when media[] is absent", () => {
        expect(postCover({ images: ["legacy.jpg"] })).toEqual({ url: "legacy.jpg", isVideo: false });
    });

    it("skips a posterless video so a later image can cover the post", () => {
        expect(postCover({ media: [vid("clip.mp4"), img("b.jpg")] })).toEqual({ url: "b.jpg", isVideo: false });
    });

    it("returns null when there is nothing displayable", () => {
        expect(postCover({ media: [], images: [] })).toBeNull();
        expect(postCover({ media: [vid("clip.mp4")] })).toBeNull();
    });
});
