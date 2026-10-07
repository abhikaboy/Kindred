import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { MusicNote, Pause, Play, Plus } from "@phosphor-icons/react";
import { ThemedText } from "@/components/ThemedText";
import { cn } from "@/lib/utils";

// Three bars that bounce while the preview plays, at rest otherwise.
function Equalizer({ playing }: { playing: boolean }) {
  return (
    <span aria-hidden className="flex h-3 items-end gap-[2px]">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={cn("w-[3px] origin-bottom rounded-full bg-primary", playing ? "eq-bar" : "h-1 opacity-50")}
          style={playing ? { animationDelay: `${i * 140}ms` } : undefined}
        />
      ))}
    </span>
  );
}

type Song = { title: string; artist: string; artworkUrl?: string; previewUrl?: string };

/** One quiet "now playing" line under the name: art, title · artist, tap to preview. */
export function NowPlaying({ song, editable }: { song?: Song | null; editable?: boolean }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  if (!song) {
    if (!editable) return null;
    return (
      <Link
        to="/profile/edit"
        className="inline-flex w-fit items-center gap-2 rounded-full py-1 pr-3 text-muted-foreground transition-colors duration-150 hover:text-foreground"
      >
        <Plus size={14} />
        <ThemedText type="caption" className="text-inherit">
          Add a song to your profile
        </ThemedText>
      </Link>
    );
  }

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      setPlaying(false);
    } else {
      void a.play();
      setPlaying(true);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={playing ? `Pause ${song.title}` : `Play ${song.title}`}
      className="group -ml-1 inline-flex w-fit max-w-full items-center gap-2.5 rounded-full py-1 pl-1 pr-3 transition-colors duration-150 hover:bg-muted/60"
    >
      <span className="relative size-7 shrink-0 overflow-hidden rounded-md bg-primary/10">
        {song.artworkUrl ? (
          <img src={song.artworkUrl} alt="" className="size-full object-cover" />
        ) : (
          <MusicNote size={14} className="absolute inset-0 m-auto text-primary" />
        )}
        <span className="absolute inset-0 grid place-items-center bg-black/35 text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          {playing ? <Pause size={12} weight="fill" /> : <Play size={12} weight="fill" />}
        </span>
      </span>
      <Equalizer playing={playing} />
      <ThemedText type="caption" className="truncate">
        <span className="text-foreground">{song.title}</span> · {song.artist}
      </ThemedText>
      <audio ref={audioRef} src={song.previewUrl} onEnded={() => setPlaying(false)} />
    </button>
  );
}
