import { BlueprintCard } from "@/components/BlueprintCard";
import { ThemedText } from "@/components/ThemedText";
import { Skeleton } from "@/components/ui/skeleton";
import { useBlueprintsByCategory } from "@/hooks/useBlueprints";

// Library browse view: one horizontal, Netflix-style row per category.
export function ExplorePage() {
  const { data: groups, isLoading, error } = useBlueprintsByCategory();

  if (isLoading) return <ExploreSkeleton />;

  if (error) {
    return <ThemedText type="caption">Couldn't load blueprints.</ThemedText>;
  }

  const populated = (groups ?? []).filter((g) => g.blueprints.length > 0);

  if (populated.length === 0) {
    return <ThemedText type="caption">No blueprints yet.</ThemedText>;
  }

  return (
    <div className="flex flex-col gap-8">
      {populated.map((group) => (
        <section key={group.category} className="flex flex-col gap-3">
          <ThemedText type="subtitle" as="h2">
            {group.category || "Uncategorized"}
          </ThemedText>
          <div className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {group.blueprints.map((bp) => (
              <BlueprintCard key={bp.id} blueprint={bp} className="w-60 shrink-0" />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function ExploreSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      {Array.from({ length: 3 }).map((_, s) => (
        <section key={s} className="flex flex-col gap-3">
          <Skeleton className="h-5 w-40" />
          <div className="flex gap-4 overflow-hidden pb-2">
            {Array.from({ length: 5 }).map((__, c) => (
              <div key={c} className="w-60 shrink-0">
                <Skeleton className="aspect-[16/10] w-full rounded-xl" />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
