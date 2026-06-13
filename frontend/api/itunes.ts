// iTunes Search API — public, no auth, no key. Returns songs + free 30s preview clips.
// https://performance-partners.apple.com/search-api

export interface Song {
    id: number;
    title: string;
    artist: string;
    previewUrl: string;
    artworkUrl?: string;
    appleMusicUrl?: string;
}

interface ItunesTrack {
    trackId?: number;
    trackName?: string;
    artistName?: string;
    previewUrl?: string;
    artworkUrl100?: string;
    trackViewUrl?: string;
}

interface ItunesResponse {
    resultCount: number;
    results: ItunesTrack[];
}

const ENDPOINT = "https://itunes.apple.com/search";

export function buildSearchUrl(term: string, limit = 15): string {
    const params = new URLSearchParams({
        term: term.trim(),
        media: "music",
        entity: "song",
        limit: String(limit),
    });
    return `${ENDPOINT}?${params.toString()}`;
}

export function mapItunesResults(raw: ItunesResponse): Song[] {
    if (!raw?.results) return [];
    return raw.results
        .filter((t) => typeof t.trackId === "number" && !!t.previewUrl)
        .map((t) => ({
            id: t.trackId as number,
            title: t.trackName ?? "Unknown",
            artist: t.artistName ?? "Unknown artist",
            previewUrl: t.previewUrl as string,
            artworkUrl: t.artworkUrl100,
            appleMusicUrl: t.trackViewUrl,
        }));
}

export async function searchSongs(term: string, signal?: AbortSignal): Promise<Song[]> {
    if (!term.trim()) return [];
    const res = await fetch(buildSearchUrl(term), { signal });
    if (!res.ok) throw new Error(`iTunes search failed: ${res.status}`);
    const data = (await res.json()) as ItunesResponse;
    return mapItunesResults(data);
}
