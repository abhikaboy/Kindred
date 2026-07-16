import { useMemo, useState } from "react";
import { CaretDown, CaretRight, Plus, Stack } from "@phosphor-icons/react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PropertyPill } from "@/components/create/PropertyPill";
import { cn } from "@/lib/utils";
import type { SelectedCategory } from "@/components/create/types";
import type { WorkspaceResult } from "@/hooks/useWorkspaces";

export function CategoryPopover({
  workspaces,
  selected,
  onSelect,
  onNew,
  breadcrumb,
}: {
  workspaces: WorkspaceResult[];
  selected: SelectedCategory | null;
  onSelect: (c: SelectedCategory) => void;
  onNew: () => void;
  breadcrumb?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const colorOf = useMemo(() => {
    const map = new Map<string, string | undefined>();
    workspaces.forEach((ws) => map.set(ws.name, ws.color));
    return map;
  }, [workspaces]);

  const dot = (workspaceName: string | undefined) => (
    <span
      className="size-2.5 shrink-0 rounded-full"
      style={{ backgroundColor: (workspaceName && colorOf.get(workspaceName)) || "var(--muted-foreground)" }}
    />
  );

  // Breadcrumb = borderless compact chip (top of the dialog, Linear-style).
  const trigger = breadcrumb ? (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-foreground transition-colors hover:bg-muted"
    >
      {selected ? dot(selected.workspaceName) : <Stack size={14} />}
      {selected ? (
        <span className="flex items-center gap-1 whitespace-nowrap">
          <span className="text-muted-foreground">{selected.workspaceName}</span>
          <CaretRight size={11} className="text-muted-foreground/60" />
          <span>{selected.name}</span>
        </span>
      ) : (
        <span className="whitespace-nowrap">Select category</span>
      )}
      <CaretDown size={12} className="text-muted-foreground" />
    </button>
  ) : (
    <PropertyPill
      active
      className="font-medium"
      icon={selected ? dot(selected.workspaceName) : <Stack size={14} />}
    >
      {selected?.name ?? "Category"}
    </PropertyPill>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={trigger} />
      <PopoverContent className="w-[36rem] max-w-[calc(100vw-2rem)] p-2">
        {/* Workspaces flow across 3 columns; each group stays intact for easy scanning. */}
        <div className="max-h-80 gap-4 overflow-y-auto [column-count:3]">
          {workspaces.map((ws) => (
            <div key={ws.name} className="mb-3 break-inside-avoid">
              <div className="truncate px-2 py-1 text-xs font-medium text-muted-foreground">{ws.name}</div>
              {ws.categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    onSelect({ id: c.id, name: c.name, workspaceName: c.workspaceName });
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted",
                    selected?.id === c.id && "bg-muted",
                  )}
                >
                  {dot(ws.name)}
                  <span className="truncate">{c.name}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            onNew();
          }}
          className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-muted-foreground hover:bg-muted"
        >
          <Plus size={14} />
          New category
        </button>
      </PopoverContent>
    </Popover>
  );
}
