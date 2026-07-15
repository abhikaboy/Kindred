import { useState, type JSX } from "react";
import { cn } from "@/lib/utils";
import { Lightbox } from "@/components/feed/Lightbox";
import type { components } from "@/lib/api/types.gen";

type MediaItem = components["schemas"]["MediaItem"];

type Tile = { type: string; url: string };

export function PostCardMedia({
  media,
  images,
}: {
  media: MediaItem[];
  images: string[];
}): JSX.Element | null {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const tiles: Tile[] =
    media && media.length > 0
      ? media.map((m) => ({ type: m.type, url: m.url }))
      : (images ?? []).map((url) => ({ type: "image", url }));

  if (tiles.length === 0) return null;

  // Lightbox only cycles images; keep an image-only URL list for indexing.
  const imageUrls = tiles.filter((t) => t.type === "image").map((t) => t.url);
  const openLightbox = (url: string) => {
    const idx = imageUrls.indexOf(url);
    if (idx >= 0) setLightboxIndex(idx);
  };

  const count = tiles.length;
  const gridClass =
    count === 1
      ? "grid-cols-1"
      : count === 3
        ? "grid-cols-2"
        : "grid-cols-2";

  return (
    <>
      <div className={cn("grid gap-1.5", gridClass)}>
        {tiles.slice(0, 4).map((tile, i) => {
          const spanTwo = count === 3 && i === 0;
          const overlayN = i === 3 && count > 4 ? count - 4 : 0;
          if (tile.type === "video") {
            return <VideoTile key={i} url={tile.url} spanTwo={spanTwo} single={count === 1} />;
          }
          return (
            <button
              key={i}
              type="button"
              onClick={() => openLightbox(tile.url)}
              className={cn(
                "relative overflow-hidden rounded-xl cursor-pointer",
                spanTwo && "col-span-2"
              )}
            >
              <img
                src={tile.url}
                alt=""
                className={cn(
                  "w-full object-cover",
                  count === 1 ? "max-h-[70vh]" : "aspect-square"
                )}
              />
              {overlayN > 0 ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-2xl font-medium text-white">
                  +{overlayN}
                </div>
              ) : null}
            </button>
          );
        })}
      </div>
      <Lightbox
        open={lightboxIndex !== null}
        onClose={() => setLightboxIndex(null)}
        images={imageUrls}
        index={lightboxIndex ?? 0}
      />
    </>
  );
}

function VideoTile({
  url,
  spanTwo,
  single,
}: {
  url: string;
  spanTwo: boolean;
  single: boolean;
}): JSX.Element {
  const [active, setActive] = useState(false);
  return (
    <video
      src={url}
      muted={!active}
      loop
      playsInline
      autoPlay
      controls={active}
      onClick={() => setActive(true)}
      className={cn(
        "w-full rounded-xl cursor-pointer object-cover",
        spanTwo && "col-span-2",
        single ? "max-h-[70vh]" : "aspect-square"
      )}
    />
  );
}

export default PostCardMedia;
