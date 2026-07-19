import { useCallback, useEffect, useMemo, useState } from "react";
import type { KeyboardEvent, Ref, TextareaHTMLAttributes } from "react";
import { useMentionTrigger } from "@/hooks/useMentionTrigger";
import { useFriends, type FriendReference } from "@/hooks/useConnections";
import { cn } from "@/lib/utils";

type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange"> & {
  value: string;
  onChange: (value: string) => void;
  onMentionPicked?: (friend: FriendReference) => void;
  textareaRef?: Ref<HTMLTextAreaElement>;
};

const MAX = 6;

// Textarea with an inline "@" mention autocomplete. A user is only tagged when
// picked from the menu (explicit-pick-only); editing the text never re-tags.
export function MentionTextarea({
  value,
  onChange,
  onMentionPicked,
  textareaRef,
  onKeyDown,
  onBlur,
  className,
  ...rest
}: Props) {
  const { ref, query, onInput, onCaret, pick, close } = useMentionTrigger(value, onChange);
  const { data: friends } = useFriends();
  const [active, setActive] = useState(0);

  const matches = useMemo(() => {
    if (query === null) return [];
    const q = query.toLowerCase();
    return (friends ?? [])
      .filter(
        (f) =>
          f.handle.replace(/^@/, "").toLowerCase().includes(q) ||
          f.display_name.toLowerCase().includes(q),
      )
      .slice(0, MAX);
  }, [friends, query]);

  const open = query !== null && matches.length > 0;
  useEffect(() => setActive(0), [query]);

  // Fan the hook's ref out to an optional external ref (e.g. for autofocus).
  const setRefs = useCallback(
    (node: HTMLTextAreaElement | null) => {
      (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = node;
      if (typeof textareaRef === "function") textareaRef(node);
      else if (textareaRef)
        (textareaRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = node;
    },
    [ref, textareaRef],
  );

  const choose = (f: FriendReference) => {
    pick(f.handle);
    onMentionPicked?.(f);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (open) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((i) => (i + 1) % matches.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((i) => (i - 1 + matches.length) % matches.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        choose(matches[Math.min(active, matches.length - 1)]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
    }
    onKeyDown?.(e);
  };

  return (
    <div className="relative">
      <textarea
        ref={setRefs}
        value={value}
        onChange={onInput}
        onKeyUp={onCaret}
        onClick={onCaret}
        onSelect={onCaret}
        onKeyDown={handleKeyDown}
        onBlur={(e) => {
          setTimeout(close, 120);
          onBlur?.(e);
        }}
        className={className}
        {...rest}
      />
      {open ? (
        <ul className="absolute left-0 top-full z-50 mt-1 w-64 max-w-full overflow-hidden rounded-xl border bg-popover p-1 shadow-lg">
          {matches.map((f, i) => (
            <li key={f._id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(f)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left",
                  i === active ? "bg-muted" : "hover:bg-muted",
                )}
              >
                <img
                  src={f.profile_picture}
                  alt=""
                  className="size-6 shrink-0 rounded-full bg-muted object-cover"
                />
                <span className="flex min-w-0 flex-col leading-tight">
                  <span className="truncate text-sm">{f.display_name}</span>
                  <span className="truncate text-xs text-muted-foreground">{f.handle}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default MentionTextarea;
