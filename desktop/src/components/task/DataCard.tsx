import type { ReactNode } from "react";
import { ThemedText } from "@/components/ThemedText";

// A titled detail section (icon + heading, then content) — desktop port of the
// mobile task-detail DataCard. Not a bordered card; a labelled content block.
export function DataCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        {icon}
        <ThemedText type="subtitle">{title}</ThemedText>
      </div>
      {children}
    </section>
  );
}

export default DataCard;
