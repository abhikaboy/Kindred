import type { ReactNode } from "react";
import { ThemedText } from "@/components/ThemedText";
import { cn } from "@/lib/utils";

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
    <section className={cn("flex flex-col rounded-2xl border border-border p-5", className)}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <ThemedText type="subtitle" as="h3">
          {title}
        </ThemedText>
        {headerRight}
      </div>
      {children}
      {takeaway ? (
        <ThemedText type="caption" className="mt-4">
          {takeaway}
        </ThemedText>
      ) : null}
    </section>
  );
}
