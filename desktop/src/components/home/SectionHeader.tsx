import type { ReactNode } from "react";
import { ThemedText } from "@/components/ThemedText";

// Home section label (mirrors mobile SectionHeader, minus the hide-toggle for now).
export function SectionHeader({
  title,
  right,
}: {
  title: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <ThemedText type="caption" className="uppercase tracking-wider">
        {title}
      </ThemedText>
      {right}
    </div>
  );
}
