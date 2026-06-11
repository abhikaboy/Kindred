import { assetsToPickedMedia, resolvePlayableVideo, type PickedMedia } from "../api/media";

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

describe("resolvePlayableVideo", () => {
    const thumb = { uri: "file://thumb.jpg", width: 720, height: 1280 };

    it("uses the compressed file when it opens", async () => {
        const getThumbnail = jest.fn().mockResolvedValue(thumb);
        const result = await resolvePlayableVideo("file://orig.mov", "file://compressed.mp4", getThumbnail);
        expect(result.uploadUri).toBe("file://compressed.mp4");
        expect(getThumbnail).toHaveBeenCalledTimes(1);
    });

    it("falls back to the original when the compressed file can't be opened", async () => {
        const getThumbnail = jest
            .fn()
            .mockRejectedValueOnce(new Error("Cannot Open"))
            .mockResolvedValueOnce(thumb);
        const result = await resolvePlayableVideo("file://orig.mov", "file://compressed.mp4", getThumbnail);
        expect(result.uploadUri).toBe("file://orig.mov");
        expect(getThumbnail).toHaveBeenCalledTimes(2);
    });

    it("rethrows when compression was skipped (same uri) and it can't be opened", async () => {
        const getThumbnail = jest.fn().mockRejectedValue(new Error("Cannot Open"));
        await expect(
            resolvePlayableVideo("file://same.mov", "file://same.mov", getThumbnail)
        ).rejects.toThrow("Cannot Open");
        expect(getThumbnail).toHaveBeenCalledTimes(1);
    });
});
