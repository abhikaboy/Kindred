import type { JSX } from "react";

export const FEED_REACTION_EMOJIS = [
  "👍",
  "❤️",
  "🔥",
  "🎉",
  "😂",
  "😮",
  "😢",
  "🙌",
  "👏",
  "💪",
  "✅",
  "👀",
] as const;

type EmojiPickerProps = {
  open: boolean;
  onSelect: (emoji: string) => void;
  onClose: () => void;
};

export function EmojiPicker({ open, onSelect, onClose }: EmojiPickerProps): JSX.Element | null {
  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute bottom-full left-0 z-50 mb-2 grid grid-cols-6 gap-1 rounded-2xl border bg-card p-2 shadow-lg">
        {FEED_REACTION_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            aria-label={`React ${emoji}`}
            onClick={() => {
              onSelect(emoji);
              onClose();
            }}
            className="h-8 w-8 rounded-lg text-xl transition-colors hover:bg-muted cursor-pointer"
          >
            {emoji}
          </button>
        ))}
      </div>
    </>
  );
}

export default EmojiPicker;
