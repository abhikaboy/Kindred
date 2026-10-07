import { useState } from "react";
import { Link } from "react-router-dom";
import { Images, Play } from "@phosphor-icons/react";
import { ThemedText } from "@/components/ThemedText";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useProfilePhotos } from "./useProfilePhotos";

/** Full-width photo wall; the newest post takes a 2x2 feature tile. */
export function ProfileGallery({ userId }: { userId: string }) {
  const { photos: all, isLoading, error } = useProfilePhotos(userId);
  // Photos whose image fails to load drop out instead of leaving empty tiles.
  const [broken, setBroken] = useState<Set<string>>(() => new Set());
  const photos = all.filter((p) => !broken.has(p.id));

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className={cn("aspect-square rounded-xl", i === 0 && "col-span-2 row-span-2")} />
        ))}
      </div>
    );
  }

  if (error) return <ThemedText type="caption">Couldn't load posts.</ThemedText>;

  if (photos.length === 0) {
    return <EmptyState icon={Images} title="No posts yet" description="Photos and videos will appear here." />;
  }

  return (
    <div className="grid grid-cols-3 gap-2 lg:grid-cols-4">
      {photos.map((photo, i) => (
        <Link
          key={photo.id}
          to={`/post/${photo.id}`}
          className={cn(
            "group relative aspect-square overflow-hidden rounded-xl bg-muted animate-in fade-in duration-300",
            i === 0 && "col-span-2 row-span-2"
          )}
          style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}
        >
          <img
            src={photo.thumb}
            alt={photo.caption ?? ""}
            loading="lazy"
            onError={() => setBroken((prev) => new Set(prev).add(photo.id))}
            className="size-full object-cover text-transparent transition-transform duration-500 ease-out group-hover:scale-[1.04]"
          />
          {photo.caption && (
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              <ThemedText type="caption" className="line-clamp-2 text-white">
                {photo.caption}
              </ThemedText>
            </div>
          )}
          {photo.isVideo && <Play weight="fill" className="absolute right-2 top-2 size-4 text-white drop-shadow" />}
        </Link>
      ))}
    </div>
  );
}
