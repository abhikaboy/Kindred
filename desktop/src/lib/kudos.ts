// A kudos message is media (image/GIF URL) when it's a bare URL; otherwise plain text.
export function isMediaUrl(message?: string): boolean {
  return !!message && /^https?:\/\/\S+$/i.test(message.trim());
}
