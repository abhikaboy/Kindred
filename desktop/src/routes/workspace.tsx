import { useEffect, useRef, useState } from "react";
import { Plus, Stack } from "@phosphor-icons/react";
import { useNavigate, useParams } from "react-router-dom";
import { CategoryCard } from "@/components/CategoryCard";
import { useCreate } from "@/components/create/CreateContext";
import { EmptyState } from "@/components/EmptyState";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspace, useWorkspaces } from "@/hooks/useWorkspaces";

// Arrow-key nav shouldn't fire while typing or with a dialog/menu open.
function navBlocked(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return true;
  return !!document.querySelector('[role="dialog"], [role="menu"]');
}

export default function WorkspaceScreen() {
  const { name: rawName } = useParams();
  const name = rawName ? decodeURIComponent(rawName) : undefined;
  const navigate = useNavigate();
  const { workspace, isLoading } = useWorkspace(name);
  const { data: allWorkspaces } = useWorkspaces();
  const { openCreateCategory, openCreateTask, setCategoryShortcuts } = useCreate();

  const categories = workspace?.categories ?? [];
  const [selected, setSelected] = useState(0);
  const selectedRef = useRef<HTMLDivElement>(null);

  // Reset the highlighted category when the workspace changes.
  useEffect(() => setSelected(0), [name]);

  // Keep the highlighted category in view while arrowing through a long list.
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  // ←/→ switch workspace (sidebar order, wrapping); ↑/↓ move the highlighted
  // category; Enter starts a task in it.
  useEffect(() => {
    const list = allWorkspaces ?? [];
    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey || navBlocked(e.target)) return;
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        const idx = list.findIndex((w) => w.name === name);
        if (idx < 0 || list.length < 2) return;
        e.preventDefault();
        const next = e.key === "ArrowLeft" ? (idx - 1 + list.length) % list.length : (idx + 1) % list.length;
        navigate(`/workspace/${encodeURIComponent(list[next].name)}`);
      } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        if (categories.length === 0) return;
        e.preventDefault();
        setSelected((s) => Math.max(0, Math.min(categories.length - 1, e.key === "ArrowUp" ? s - 1 : s + 1)));
      } else if (e.key === "Enter") {
        const cat = categories[selected];
        if (!cat) return;
        e.preventDefault();
        openCreateTask({ categoryId: cat.id });
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [allWorkspaces, name, categories, selected, navigate, openCreateTask]);

  // Register the on-screen categories (first 9) so Shift+1..9 creates a task in each.
  const shortcutIds = (workspace?.categories ?? []).slice(0, 9).map((c) => c.id).join(",");
  useEffect(() => {
    const ids = shortcutIds ? shortcutIds.split(",") : [];
    setCategoryShortcuts(ids.map((id) => ({ id })));
    return () => setCategoryShortcuts([]);
  }, [shortcutIds, setCategoryShortcuts]);

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
          {categories.map((category, i) => (
            <div key={category.id} ref={i === selected ? selectedRef : undefined}>
              <CategoryCard
                category={category}
                accent={workspace.color}
                shortcutIndex={i < 9 ? i + 1 : undefined}
                selected={i === selected}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
