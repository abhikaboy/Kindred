import { useMemo, useState } from "react";
import { LinkSimple, Plus, X } from "@phosphor-icons/react";
import { DataCard } from "@/components/task/DataCard";
import { ThemedText } from "@/components/ThemedText";
import { AUTH_HEADER, useUpdateTaskLinks } from "@/hooks/useTaskActions";
import { normalizeLink, syncNotesLinks, type TaskLink } from "@shared/taskLinks";
import type { TaskDocument } from "@/hooks/useWorkspaces";

/**
 * Links attached to a task. URLs typed into the notes are picked up by the
 * backend on every notes save; `notes` is passed in live so they also appear
 * the moment they're typed, before that save lands.
 */
export function TaskLinksCard({
  task,
  categoryId,
  notes,
}: {
  task: TaskDocument;
  categoryId: string;
  notes: string;
}) {
  const [draft, setDraft] = useState("");
  const updateLinks = useUpdateTaskLinks();

  const links = useMemo(() => syncNotesLinks(task.links, notes), [task.links, notes]);

  const persist = (next: TaskLink[]) => {
    updateLinks.mutate({
      params: { header: AUTH_HEADER, path: { category: categoryId, id: task.id } },
      body: { links: next },
    });
  };

  const handleAdd = () => {
    const link = normalizeLink(draft);
    if (!link) return;
    setDraft("");
    persist([...links, link]);
  };

  return (
    <DataCard title="Links" icon={<LinkSimple size={20} weight="regular" className="text-foreground" />}>
      <div className="flex flex-col gap-2">
        {links.map((link) => (
          <div key={link.url} className="group flex items-center gap-3 rounded-lg bg-secondary/60 px-3 py-2">
            <LinkSimple size={16} weight="bold" className="shrink-0 text-primary" />
            <a
              href={link.url}
              target="_blank"
              rel="noreferrer"
              className="min-w-0 flex-1 truncate text-sm font-light text-foreground hover:underline"
              title={link.url}
            >
              {link.title || link.url}
            </a>
            <button
              type="button"
              aria-label={`Remove ${link.title || link.url}`}
              onClick={() => persist(links.filter((l) => l.url !== link.url))}
              className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
            >
              <X size={14} weight="bold" />
            </button>
          </div>
        ))}

        <div className="flex items-center gap-3 px-3 py-2">
          <Plus size={16} weight="bold" className="shrink-0 text-muted-foreground" />
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd();
              }
            }}
            onBlur={handleAdd}
            placeholder="Paste or type a link"
            className="min-w-0 flex-1 bg-transparent text-sm font-light text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>

        {links.length === 0 && !draft ? (
          <ThemedText type="caption" className="px-3">
            Links in your notes show up here automatically.
          </ThemedText>
        ) : null}
      </div>
    </DataCard>
  );
}
