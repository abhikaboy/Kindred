import type { ReactNode } from "react";
import type { Icon } from "@phosphor-icons/react";
import { ThemedText } from "@/components/ThemedText";
import { cn } from "@/lib/utils";

// Shared empty state — icon in a tinted circle, title, instructional copy, optional
// CTA. Ports the mobile pattern (dashboard/FriendsContent, profile/ProfileGallery).
export function EmptyState({
  icon: IconCmp,
  title,
  description,
  action,
  className,
}: {
  icon?: Icon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-start gap-3 py-10", className)}>
      {IconCmp && (
        <div className="flex size-14 items-center justify-center rounded-full bg-primary/10">
          <IconCmp size={28} weight="duotone" className="text-primary" />
        </div>
      )}
      <div className="flex flex-col gap-1">
        <ThemedText type="subtitle">{title}</ThemedText>
        {description && (
          <ThemedText type="lightBody" className="max-w-md text-muted-foreground">
            {description}
          </ThemedText>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

export default EmptyState;
