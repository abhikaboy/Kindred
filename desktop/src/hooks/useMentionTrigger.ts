import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { detectMention, applyMention, type MentionMatch } from "@/lib/mention";

// Tracks an active "@query" at the textarea caret and splices a picked handle in.
// The DOM twin of mobile's useMentionTrigger. Pure detection lives in lib/mention.
export function useMentionTrigger(value: string, onChange: (v: string) => void) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [match, setMatch] = useState<MentionMatch | null>(null);

  const recompute = (text: string, caret: number) => setMatch(detectMention(text, caret));

  const onInput = (e: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
    recompute(e.target.value, e.target.selectionStart ?? e.target.value.length);
  };

  const onCaret = () => {
    const el = ref.current;
    if (el) recompute(el.value, el.selectionStart ?? 0);
  };

  const pick = (handle: string) => {
    if (!match) return;
    const el = ref.current;
    const caret = el?.selectionStart ?? value.length;
    const res = applyMention(value, match.start, caret, handle);
    onChange(res.text);
    setMatch(null);
    requestAnimationFrame(() => {
      if (el) {
        el.focus();
        el.setSelectionRange(res.caret, res.caret);
      }
    });
  };

  return { ref, query: match?.query ?? null, onInput, onCaret, pick, close: () => setMatch(null) };
}
