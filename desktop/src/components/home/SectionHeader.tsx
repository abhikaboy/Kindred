import type { ReactNode } from "react";
import { ThemedText } from "@/components/ThemedText";

// Section title: sentence case at 17px (mobile's prominent SectionHeader). No eyebrow captions.
export function SectionHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <ThemedText type="larger_default">{title}</ThemedText>
      {right}
    </div>
  );
}
