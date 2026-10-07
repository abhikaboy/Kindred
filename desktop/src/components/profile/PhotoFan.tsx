import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useProfilePhotos } from "./useProfilePhotos";

// Resting tilt per card, left to right; hovering the fan spreads them apart.
const POSES = [
  "-rotate-[8deg] -translate-x-14 translate-y-2 group-hover:-rotate-12 group-hover:-translate-x-24",
  "z-10 rotate-0 -translate-y-1 group-hover:-translate-y-3",
  "rotate-[8deg] translate-x-14 translate-y-2 group-hover:rotate-12 group-hover:translate-x-24",
];

/** The latest three photos as a hand of cards beside the identity. */
export function PhotoFan({ userId }: { userId: string }) {
  const { photos } = useProfilePhotos(userId);
  const hand = photos.slice(0, 3);
  if (hand.length === 0) return null;

  return (
    <div className="group relative hidden h-60 w-96 shrink-0 items-center justify-center md:flex">
      {hand.map((photo, i) => (
        <Link
          key={photo.id}
          to={`/post/${photo.id}`}
          className={cn(
            "absolute aspect-[4/5] w-36 overflow-hidden rounded-2xl bg-muted shadow-[0_12px_32px_-12px_rgba(0,0,0,0.35)] ring-4 ring-background transition-transform duration-300 ease-[cubic-bezier(0.2,0,0,1)] hover:z-20 hover:scale-105",
            POSES[hand.length === 1 ? 1 : i]
          )}
        >
          <img
            src={photo.thumb}
            alt={photo.caption ?? ""}
            onError={(e) => (e.currentTarget.style.visibility = "hidden")}
            className="size-full object-cover text-transparent"
          />
        </Link>
      ))}
    </div>
  );
}
