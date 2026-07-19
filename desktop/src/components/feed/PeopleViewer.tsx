import type { JSX } from "react";
import { Link } from "react-router-dom";
import { ThemedText } from "@/components/ThemedText";

export type Person = { id?: string; name: string; handle?: string; icon?: string };

type PeopleViewerProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  groups: { label?: string; people: Person[] }[];
};

export function PeopleViewer({ open, onClose, title, groups }: PeopleViewerProps): JSX.Element | null {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-in fade-in-0 duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border bg-card p-5 shadow-xl max-h-[70vh] overflow-y-auto animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <ThemedText type="subtitle" as="h2">
          {title}
        </ThemedText>
        <div className="mt-4 flex flex-col gap-4">
          {groups.map((group, gi) => (
            <div key={group.label ?? gi} className="flex flex-col gap-2">
              {group.label ? (
                <ThemedText type="caption" as="p" className="uppercase tracking-wide">
                  {group.label}
                </ThemedText>
              ) : null}
              {group.people.length === 0 ? (
                <ThemedText type="caption" as="p">
                  No one yet
                </ThemedText>
              ) : (
                group.people.map((person, pi) => {
                  const row = (
                    <>
                      <img
                        src={person.icon}
                        alt={person.name}
                        className="h-8 w-8 rounded-full object-cover bg-muted"
                      />
                      <ThemedText type="defaultSemiBold" as="span">
                        {person.name}
                      </ThemedText>
                      {person.handle ? (
                        <ThemedText type="caption" as="span">
                          {person.handle}
                        </ThemedText>
                      ) : null}
                    </>
                  );
                  const key = person.id ?? `${person.handle ?? person.name}-${pi}`;
                  return person.id ? (
                    <Link
                      key={key}
                      to={`/account/${person.id}`}
                      onClick={onClose}
                      className="flex items-center gap-3 rounded-lg -mx-1 px-1 py-0.5 hover:bg-muted"
                    >
                      {row}
                    </Link>
                  ) : (
                    <div key={key} className="flex items-center gap-3">
                      {row}
                    </div>
                  );
                })
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default PeopleViewer;
