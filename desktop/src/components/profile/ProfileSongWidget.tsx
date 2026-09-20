import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MusicNote, Pause, Play } from "@phosphor-icons/react";
import { useAuth } from "@/contexts/auth";
import { ThemedText } from "@/components/ThemedText";

export function ProfileSongWidget() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const song = user?.song;
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [playing, setPlaying] = useState(false);

    if (!song) {
        return (
            <button
                onClick={() => navigate("/profile/edit")}
                className="flex w-full items-center gap-3 rounded-xl bg-secondary/60 p-3 text-left transition-colors hover:bg-secondary"
            >
                <span className="grid size-11 place-items-center rounded-lg bg-primary/10">
                    <MusicNote className="size-5 text-primary" />
                </span>
                <ThemedText type="caption">Add music to your profile</ThemedText>
            </button>
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
        <div className="flex items-center gap-3 rounded-xl bg-secondary/60 p-3">
            {song.artworkUrl ? (
                <img src={song.artworkUrl} alt="" className="size-11 rounded-lg object-cover" />
            ) : (
                <div className="grid size-11 place-items-center rounded-lg bg-primary/10">
                    <MusicNote className="size-5 text-primary" />
                </div>
            )}
            <div className="min-w-0 flex-1">
                <ThemedText type="smallerDefault" as="div" className="truncate text-foreground/90">
                    {song.title}
                </ThemedText>
                <ThemedText type="caption" as="div" className="truncate text-xs">
                    {song.artist}
                </ThemedText>
            </div>
            <button
                onClick={toggle}
                aria-label={playing ? "Pause preview" : "Play preview"}
                className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary transition-colors hover:bg-primary/20"
            >
                {playing ? <Pause weight="fill" className="size-4" /> : <Play weight="fill" className="size-4" />}
            </button>
            <audio ref={audioRef} src={song.previewUrl} onEnded={() => setPlaying(false)} />
        </div>
    );
}
