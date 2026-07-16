import { useEffect, useState, type JSX } from "react";
import { ThemedText } from "@/components/ThemedText";

const KEY = import.meta.env.VITE_TENOR_API_KEY as string | undefined;
const CLIENT = "kindred_app";

type Gif = { id: string; media_formats?: { gif?: { url: string }; tinygif?: { url: string } } };

// Tenor GIF search (featured until you type). Picks the full gif url; previews the tinygif.
export function GifPicker({ onSelect }: { onSelect: (url: string) => void }): JSX.Element {
  const [q, setQ] = useState("");
  const [gifs, setGifs] = useState<Gif[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!KEY) return;
    let cancelled = false;
    setLoading(true);
    const query = q.trim();
    const url = query
      ? `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}&key=${KEY}&client_key=${CLIENT}&limit=20&contentfilter=low`
      : `https://tenor.googleapis.com/v2/featured?key=${KEY}&client_key=${CLIENT}&limit=20&contentfilter=low`;
    const t = setTimeout(
      async () => {
        try {
          const res = await fetch(url);
          const data = await res.json();
          if (!cancelled) setGifs(data.results ?? []);
        } catch {
          if (!cancelled) setGifs([]);
        } finally {
          if (!cancelled) setLoading(false);
        }
      },
      query ? 400 : 0
    );
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q]);

  if (!KEY) {
    return (
      <ThemedText type="caption" className="text-muted-foreground">
        GIF search is unavailable (set VITE_TENOR_API_KEY).
      </ThemedText>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search GIFs…"
        className="h-9 w-full rounded-xl border bg-background px-3 text-sm text-foreground outline-none"
      />
      <div className="grid max-h-56 grid-cols-2 gap-2 overflow-y-auto">
        {gifs.map((g) => {
          const preview = g.media_formats?.tinygif?.url ?? g.media_formats?.gif?.url;
          const full = g.media_formats?.gif?.url ?? g.media_formats?.tinygif?.url;
          if (!preview || !full) return null;
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => onSelect(full)}
              className="overflow-hidden rounded-lg border transition-opacity hover:opacity-80"
            >
              <img src={preview} alt="" className="h-24 w-full object-cover" />
            </button>
          );
        })}
        {loading && gifs.length === 0 ? (
          <ThemedText type="caption" className="col-span-2 py-4 text-center text-muted-foreground">
            Loading…
          </ThemedText>
        ) : null}
      </div>
    </div>
  );
}

export default GifPicker;
