import { Compass } from "@phosphor-icons/react";
import { ThemedText } from "@/components/ThemedText";
import type { BlueprintDocument } from "@/hooks/useBlueprints";
import { cn } from "@/lib/utils";

// Library-style cover card: flat (no shadow), cover art with a hover zoom, title + meta below.
export function BlueprintCard({
  blueprint,
  className,
}: {
  blueprint: BlueprintDocument;
  className?: string;
}) {
  const { banner, name, subscribersCount } = blueprint;

  return (
    <div className={cn("group flex cursor-pointer flex-col gap-2", className)}>
      <div className="overflow-hidden rounded-xl bg-muted">
        {banner ? (
          <img
            src={banner}
            alt=""
            className="aspect-[16/10] w-full object-cover transition-transform duration-300 ease-out group-hover:scale-105"
          />
        ) : (
          <div className="grid aspect-[16/10] w-full place-items-center">
            <Compass size={32} weight="light" className="text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="flex flex-col gap-0.5 px-0.5">
        <ThemedText type="defaultSemiBold" className="truncate">
          {name}
        </ThemedText>
        <ThemedText type="caption" className="text-muted-foreground">
          {subscribersCount} subscribers
        </ThemedText>
      </div>
    </div>
  );
}
