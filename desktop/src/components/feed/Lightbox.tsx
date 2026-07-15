import { useEffect, useState, type JSX } from "react";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { ThemedText } from "@/components/ThemedText";

type LightboxProps = {
  open: boolean;
  onClose: () => void;
  images: string[];
  index?: number;
};

export function Lightbox({ open, onClose, images, index }: LightboxProps): JSX.Element | null {
  const [current, setCurrent] = useState(index ?? 0);
  const total = images.length;
  const multi = total > 1;

  useEffect(() => {
    if (open) setCurrent(index ?? 0);
  }, [open, index]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") setCurrent((c) => (c - 1 + total) % total);
      else if (e.key === "ArrowRight") setCurrent((c) => (c + 1) % total);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, total, onClose]);

  if (!open || total === 0) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={onClose}
    >
      {multi ? (
        <ThemedText type="caption" as="span" className="absolute right-4 top-4 text-white">
          {current + 1}/{total}
        </ThemedText>
      ) : null}
      {multi ? (
        <button
          type="button"
          aria-label="Previous image"
          className="absolute left-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white transition-colors hover:bg-black/60 cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            setCurrent((c) => (c - 1 + total) % total);
          }}
        >
          <CaretLeft size={24} />
        </button>
      ) : null}
      <img
        src={images[current]}
        alt=""
        className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain"
        onClick={(e) => e.stopPropagation()}
      />
      {multi ? (
        <button
          type="button"
          aria-label="Next image"
          className="absolute right-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white transition-colors hover:bg-black/60 cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            setCurrent((c) => (c + 1) % total);
          }}
        >
          <CaretRight size={24} />
        </button>
      ) : null}
    </div>
  );
}

export default Lightbox;
