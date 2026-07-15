import type { JSX } from "react";
import { ThemedText } from "@/components/ThemedText";
import { segmentCaption } from "@/lib/feed";

export function PostCaption({ caption }: { caption: string }): JSX.Element {
  const segments = segmentCaption(caption);
  return (
    <ThemedText type="default" as="p" className="whitespace-pre-wrap break-words">
      {segments.map((seg, i) => (
        <span key={i} className={seg.mention ? "text-primary" : "text-foreground"}>
          {seg.text}
        </span>
      ))}
    </ThemedText>
  );
}

export default PostCaption;
