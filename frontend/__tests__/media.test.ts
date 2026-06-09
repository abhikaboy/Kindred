import { assetsToPickedMedia, type PickedMedia } from "../api/media";

describe("assetsToPickedMedia", () => {
    it("tags each asset as image or video and preserves order", () => {
        const assets = [
            { uri: "file://a.jpg", type: "image" as const },
            { uri: "file://v.mov", type: "video" as const },
        ];
        const result: PickedMedia[] = assetsToPickedMedia(assets);
        expect(result.map((m) => m.type)).toEqual(["image", "video"]);
        expect(result[1].uri).toBe("file://v.mov");
    });

    it("falls back to extension when asset type is missing", () => {
        const assets = [{ uri: "file://clip.mp4" }];
        const result = assetsToPickedMedia(assets as any);
        expect(result[0].type).toBe("video");
    });
});
