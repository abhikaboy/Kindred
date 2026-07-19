// Handles already carry a leading "@"; guarantee exactly one.
export function normalizeHandle(handle: string): string {
  return handle.startsWith("@") ? handle : `@${handle}`;
}

export type MentionMatch = { query: string; start: number };

// An active @mention at the caret: an "@" preceded by whitespace or start-of-text,
// with no whitespace between it and the caret. Returns null otherwise (e.g. emails).
export function detectMention(text: string, caret: number): MentionMatch | null {
  for (let i = caret - 1; i >= 0; i--) {
    const ch = text[i];
    if (ch === "@") {
      const prev = i === 0 ? " " : text[i - 1];
      if (i === 0 || /\s/.test(prev)) return { query: text.slice(i + 1, caret), start: i };
      return null;
    }
    if (/\s/.test(ch)) return null;
  }
  return null;
}

// Replace the @query span [start, caret) with "@handle " and report the new caret.
export function applyMention(
  text: string,
  start: number,
  caret: number,
  handle: string,
): { text: string; caret: number } {
  const before = text.slice(0, start);
  const after = text.slice(caret);
  const insert = `${normalizeHandle(handle)} `;
  return { text: before + insert + after, caret: before.length + insert.length };
}
