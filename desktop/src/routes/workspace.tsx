import { Plus, Stack } from "@phosphor-icons/react";
import { useParams } from "react-router-dom";
import { CategoryCard } from "@/components/CategoryCard";
import { useCreate } from "@/components/create/CreateContext";
import { EmptyState } from "@/components/EmptyState";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspace } from "@/hooks/useWorkspaces";

export default function WorkspaceScreen() {
  const { name: rawName } = useParams();
  const name = rawName ? decodeURIComponent(rawName) : undefined;
  const { workspace, isLoading } = useWorkspace(name);
  const { openCreateCategory } = useCreate();

  if (isLoading) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-6 pt-6">
        <Skeleton className="h-9 w-56 rounded-xl" />
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-2">
        <ThemedText type="titleFraunces" as="h1">
          {name ?? "Workspace"}
        </ThemedText>
        <ThemedText type="caption" className="text-muted-foreground">
          We couldn’t find this workspace.
        </ThemedText>
      </div>
    );
  }

  const categories = workspace.categories ?? [];

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 pt-6">
      <div className="flex items-center justify-between gap-4">
        <ThemedText type="titleFraunces" as="h1">
          {workspace.name}
        </ThemedText>
        <Button
          variant="outline"
          size="sm"
          onClick={() => openCreateCategory(workspace.name)}
        >
          <Plus />
          New category
        </Button>
      </div>

      {categories.length === 0 ? (
        <EmptyState
          icon={Stack}
          title="This workspace is empty"
          description="Add a category to start organizing tasks in this workspace."
          action={
            <Button variant="outline" size="sm" onClick={() => openCreateCategory(workspace.name)}>
              <Plus />
              Add category
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-8">
          {categories.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              accent={workspace.color}
            />
          ))}
        </div>
      )}
    </div>
  );
}
