import type { ReactNode } from "react";
import { ThemedText } from "@/components/ThemedText";

// Home section label (mirrors mobile SectionHeader, minus the hide-toggle for now).
export function SectionHeader({
  title,
  right,
  variant = "caption",
}: {
  title: string;
  right?: ReactNode;
  /** "prominent" renders a body-size sentence-case title instead of the small caption. */
  variant?: "caption" | "prominent";
}) {
  return (
    <div className="flex items-center justify-between">
      {variant === "prominent" ? (
        <ThemedText type="larger_default">{title}</ThemedText>
      ) : (
        <ThemedText type="caption" className="uppercase tracking-wider">
          {title}
        </ThemedText>
      )}
      {right}
    </div>
  );
}
