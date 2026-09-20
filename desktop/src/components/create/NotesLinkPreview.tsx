import { useMemo } from "react";
import { LinkSimple } from "@phosphor-icons/react";
import { extractLinksFromNotes } from "@shared/taskLinks";

/**
 * Shows the links a description will attach to the task once it's created.
 * The backend extracts them on save; this is just so the user can see it
 * happening while they type.
 */
export function NotesLinkPreview({ notes }: { notes: string }) {
    const links = useMemo(() => extractLinksFromNotes(notes), [notes]);

    if (links.length === 0) return null;

    return (
        <div className="flex flex-wrap items-center gap-2">
            {links.map((link) => (
                <span
                    key={link.url}
                    title={link.url}
                    className="flex max-w-56 items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-light text-primary"
                >
                    <LinkSimple size={12} weight="bold" className="shrink-0" />
                    <span className="truncate">{link.title || link.url}</span>
                </span>
            ))}
        </div>
    );
}
