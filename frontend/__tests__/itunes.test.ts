import { buildSearchUrl, mapItunesResults } from "@/api/itunes";

describe("buildSearchUrl", () => {
    it("encodes the term and pins music/song params", () => {
        const url = buildSearchUrl("daft punk");
        expect(url).toContain("term=daft+punk");
        expect(url).toContain("media=music");
        expect(url).toContain("entity=song");
        expect(url).toContain("limit=15");
    });
});

describe("mapItunesResults", () => {
    it("maps fields and drops tracks without a preview url", () => {
        const songs = mapItunesResults({
            resultCount: 2,
            results: [
                {
                    trackId: 1,
                    trackName: "One More Time",
                    artistName: "Daft Punk",
                    previewUrl: "https://x/a.m4a",
                    artworkUrl100: "https://x/art.jpg",
                    trackViewUrl: "https://music/1",
                },
                { trackId: 2, trackName: "No Preview", artistName: "Nobody" },
            ],
        });
        expect(songs).toEqual([
            {
                id: 1,
                title: "One More Time",
                artist: "Daft Punk",
                previewUrl: "https://x/a.m4a",
                artworkUrl: "https://x/art.jpg",
                appleMusicUrl: "https://music/1",
            },
        ]);
    });

    it("returns [] for empty or missing results", () => {
        expect(mapItunesResults({ resultCount: 0, results: [] })).toEqual([]);
        expect(mapItunesResults(null as never)).toEqual([]);
    });
});
