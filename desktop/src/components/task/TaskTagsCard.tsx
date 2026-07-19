import { useMemo, useRef, useState } from "react";
import { UsersThree, Plus, X } from "@phosphor-icons/react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PropertyPill } from "@/components/create/PropertyPill";
import { DataCard } from "@/components/task/DataCard";
import { ThemedText } from "@/components/ThemedText";
import { useAuth } from "@/contexts/auth";
import { useFriends } from "@/hooks/useConnections";
import { AUTH_HEADER, useUpdateTaskTags } from "@/hooks/useTaskActions";
import { tagPayload, pendingIds, isLocked, type TaggedUser } from "@/lib/tags";
import { cn } from "@/lib/utils";
import type { TaskDocument } from "@/hooks/useWorkspaces";

// pending is removable/editable; watching/copied are locked. untagged = opted out (hidden).
const STATUS_LABEL: Record<string, string> = { watching: "watching", copied: "copied" };
const STATUS_CLASS: Record<string, string> = {
  pending: "text-muted-foreground",
  watching: "text-primary",
  copied: "text-emerald-500",
};

export function TaskTagsCard({ task, categoryId }: { task: TaskDocument; categoryId: string }) {
  const { user } = useAuth();
  const isOwner = !task.userID || task.userID === user?._id;
  const tagged = (task.taggedUsers ?? []).filter((u) => u.status !== "untagged");

  if (tagged.length === 0 && !isOwner) return null;

  return (
    <DataCard
      title={tagged.length > 0 ? `Tagged · ${tagged.length}` : "Tagged"}
      icon={<UsersThree size={20} weight="regular" className="text-foreground" />}
    >
      <div className="flex flex-col gap-3">
        {tagged.length > 0 ? (
          <div className="flex flex-col gap-2">
            {tagged.map((u) => (
              <TaggedRow key={u.id} user={u} task={task} categoryId={categoryId} canEdit={isOwner} />
            ))}
          </div>
        ) : (
          <ThemedText type="lightBody" className="text-muted-foreground">
            No one tagged yet.
          </ThemedText>
        )}
        {isOwner ? <TagPeoplePopover task={task} categoryId={categoryId} /> : null}
      </div>
    </DataCard>
  );
}

function TaggedRow({
  user,
  task,
  categoryId,
  canEdit,
}: {
  user: TaggedUser;
  task: TaskDocument;
  categoryId: string;
  canEdit: boolean;
}) {
  const updateTags = useUpdateTaskTags();
  const remove = () =>
    updateTags.mutate({
      params: { header: AUTH_HEADER, path: { category: categoryId, id: task.id } },
      body: { taggedUserIds: tagPayload(task.taggedUsers ?? [], pendingIds(task.taggedUsers ?? []).filter((id) => id !== user.id)) },
    });

  return (
    <div className="flex items-center gap-2">
      <img src={user.profile_picture} alt="" className="size-7 shrink-0 rounded-full bg-muted object-cover" />
      <ThemedText type="defaultSemiBold" as="span" className="min-w-0 flex-1 truncate text-sm">
        {user.display_name}
      </ThemedText>
      {STATUS_LABEL[user.status] ? (
        <ThemedText type="caption" as="span" className={cn(STATUS_CLASS[user.status])}>
          {STATUS_LABEL[user.status]}
        </ThemedText>
      ) : null}
      {canEdit && !isLocked(user) ? (
        <button
          type="button"
          aria-label={`Remove ${user.display_name}`}
          onClick={remove}
          disabled={updateTags.isPending}
          className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
        >
          <X size={14} weight="bold" />
        </button>
      ) : null}
    </div>
  );
}

function TagPeoplePopover({ task, categoryId }: { task: TaskDocument; categoryId: string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const initial = useRef<Set<string>>(new Set());
  const { data: friends } = useFriends();
  const updateTags = useUpdateTaskTags();

  const current = task.taggedUsers ?? [];
  const lockedIds = useMemo(() => new Set(current.filter(isLocked).map((u) => u.id)), [current]);

  const onOpenChange = (next: boolean) => {
    if (next) {
      const seed = new Set(pendingIds(current));
      setChecked(seed);
      initial.current = new Set(seed);
      setQ("");
    } else {
      // Save on close only if the pending selection changed.
      const changed =
        checked.size !== initial.current.size || [...checked].some((id) => !initial.current.has(id));
      if (changed) {
        updateTags.mutate({
          params: { header: AUTH_HEADER, path: { category: categoryId, id: task.id } },
          body: { taggedUserIds: tagPayload(current, [...checked]) },
        });
      }
    }
    setOpen(next);
  };

  const toggle = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const shown = (friends ?? []).filter(
    (f) =>
      !q ||
      f.handle.replace(/^@/, "").toLowerCase().includes(q.toLowerCase()) ||
      f.display_name.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        render={<PropertyPill icon={<Plus size={14} weight="bold" />} active={false} />}
      >
        Tag people
      </PopoverTrigger>
      <PopoverContent className="flex max-h-80 w-64 flex-col gap-2 p-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search friends"
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring"
        />
        <div className="flex flex-col gap-0.5 overflow-y-auto">
          {shown.length === 0 ? (
            <ThemedText type="caption" className="px-1.5 py-1 text-muted-foreground">
              No friends found.
            </ThemedText>
          ) : (
            shown.map((f) => {
              const locked = lockedIds.has(f._id);
              return (
                <label
                  key={f._id}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-1.5 py-1",
                    locked ? "opacity-60" : "cursor-pointer hover:bg-muted",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={locked || checked.has(f._id)}
                    disabled={locked}
                    onChange={() => toggle(f._id)}
                    className="size-4 accent-primary"
                  />
                  <img
                    src={f.profile_picture}
                    alt=""
                    className="size-5 shrink-0 rounded-full bg-muted object-cover"
                  />
                  <span className="truncate text-sm">{f.display_name || f.handle}</span>
                </label>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default TaskTagsCard;
