import { useEffect, useRef, type JSX } from "react";
// Registers the <emoji-picker> custom element as a side effect (must run once at import).
import "emoji-picker-element";
import { useTheme } from "@/lib/theme";

// Kept for callers that still want a small curated set (e.g. quick-react rows/tests).
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

// Full web-native emoji picker (Slack-style) backed by emoji-picker-element.
// It's a Web Component with its own shadow DOM, so we wire the `emoji-click`
// event and theme it through the documented CSS custom properties.
export function EmojiPicker({ open, onSelect, onClose }: EmojiPickerProps): JSX.Element | null {
  const pickerRef = useRef<HTMLElement | null>(null);
  const { theme } = useTheme();

  useEffect(() => {
    const el = pickerRef.current;
    if (!open || !el) return;

    const handleEmojiClick = (event: Event) => {
      const emoji = (event as CustomEvent<{ unicode?: string }>).detail?.unicode;
      if (emoji) {
        onSelect(emoji);
        onClose();
      }
    };

    el.addEventListener("emoji-click", handleEmojiClick);
    return () => el.removeEventListener("emoji-click", handleEmojiClick);
  }, [open, onSelect, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute bottom-full left-0 z-50 mb-2 overflow-hidden rounded-2xl border bg-card shadow-lg">
        <emoji-picker
          ref={pickerRef}
          // `light`/`dark` classes force the picker's theme to match the app.
          class={theme === "dark" ? "dark" : "light"}
          style={
            {
              width: "20rem",
              height: "24rem",
              "--background": "var(--card)",
              "--border-color": "var(--border)",
              "--input-border-color": "var(--border)",
              "--input-font-color": "var(--card-foreground)",
              "--input-placeholder-color": "var(--muted-foreground)",
              "--category-font-color": "var(--muted-foreground)",
              "--button-hover-background": "var(--muted)",
              "--button-active-background": "var(--muted)",
              "--indicator-color": "var(--primary)",
            } as React.CSSProperties
          }
        />
      </div>
    </>
  );
}

export default EmojiPicker;
