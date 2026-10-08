import type { ReactNode } from "react";
import { ThemedText } from "@/components/ThemedText";
import { cn } from "@/lib/utils";

// Section shell: title, then the backend's plain-language takeaway as the lead, then the detail.
export function WidgetCard({
  title,
  headerRight,
  takeaway,
  className,
  children,
}: {
  title: string;
  headerRight?: ReactNode;
  takeaway?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("flex flex-col gap-4", className)}>
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <ThemedText type="larger_default" as="h2">
            {title}
          </ThemedText>
          {headerRight}
        </div>
        {takeaway ? <ThemedText type="caption">{takeaway}</ThemedText> : null}
      </div>
      {children}
    </section>
  );
}
