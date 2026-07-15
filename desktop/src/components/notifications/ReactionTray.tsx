import type { JSX } from "react";
import { cn } from "@/lib/utils";

export const KUDOS_REACTION_EMOJIS = ["❤️", "🙌", "🔥", "😭"] as const;
export type KudosReactionEmoji = (typeof KUDOS_REACTION_EMOJIS)[number];
export const KUDOS_HEART_EMOJI: KudosReactionEmoji = "❤️";

type ReactionTrayProps = {
  open: boolean;
  currentReaction?: string | null;
  onSelect: (emoji: KudosReactionEmoji) => void;
  onClose: () => void;
};

export function ReactionTray({
  open,
  currentReaction,
  onSelect,
  onClose,
}: ReactionTrayProps): JSX.Element | null {
  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute bottom-full left-0 z-50 mb-2 flex items-center gap-1 rounded-full border bg-card px-3 py-2 shadow-lg">
        {KUDOS_REACTION_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            aria-label={`React ${emoji}`}
            onClick={() => {
              onSelect(emoji);
              onClose();
            }}
            className={cn(
              "h-11 w-11 rounded-full text-2xl transition-colors",
              currentReaction === emoji ? "bg-primary/10" : "hover:bg-muted"
            )}
          >
            {emoji}
          </button>
        ))}
      </div>
    </>
  );
}

export default ReactionTray;
