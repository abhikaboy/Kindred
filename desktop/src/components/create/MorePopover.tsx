import { useState } from "react";
import { DotsThree } from "@phosphor-icons/react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PropertyPill } from "@/components/create/PropertyPill";
import { ThemedText } from "@/components/ThemedText";
import { cn } from "@/lib/utils";
import type { TaskFormState } from "@/hooks/useCreateActions";
import type { FriendReference } from "@/hooks/useConnections";

type Setter = (updater: (prev: TaskFormState) => TaskFormState) => void;

const INTEGRATIONS = [
  { value: "", label: "None" },
  { value: "amazon", label: "Amazon" },
  { value: "gmail", label: "Gmail" },
  { value: "outlook", label: "Outlook" },
  { value: "imessage", label: "iMessage" },
  { value: "slack", label: "Slack" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "chrome", label: "Chrome" },
  { value: "safari", label: "Safari" },
];

const selectClass =
  "h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring dark:bg-input/30";

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-2">
    <ThemedText type="caption" className="text-muted-foreground">{label}</ThemedText>
    {children}
  </div>
);

export function MorePopover({
  form,
  setForm,
  friends,
}: {
  form: TaskFormState;
  setForm: Setter;
  friends: FriendReference[] | undefined;
}) {
  const [open, setOpen] = useState(false);
  const active = form.value > 1 || !!form.integration || form.taggedUserIds.length > 0;

  const toggleFriend = (id: string) =>
    setForm((prev) => ({
      ...prev,
      taggedUserIds: prev.taggedUserIds.includes(id)
        ? prev.taggedUserIds.filter((x) => x !== id)
        : [...prev.taggedUserIds, id],
    }));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<PropertyPill icon={<DotsThree size={16} weight="bold" />} active={active} />}>
        More
      </PopoverTrigger>
      <PopoverContent className="flex max-h-[26rem] w-72 flex-col gap-3 overflow-y-auto p-3">
        <Row label="Difficulty">
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, value: n }))}
                aria-label={`Difficulty ${n}`}
                className={cn(
                  "size-4 rounded-full border transition-colors",
                  n <= form.value ? "border-primary bg-primary" : "border-border hover:bg-muted",
                )}
              />
            ))}
          </div>
        </Row>

        <Row label="Integration">
          <select
            className={selectClass}
            value={form.integration}
            onChange={(e) => setForm((prev) => ({ ...prev, integration: e.target.value }))}
          >
            {INTEGRATIONS.map((i) => (
              <option key={i.value || "none"} value={i.value}>{i.label}</option>
            ))}
          </select>
        </Row>

        {friends && friends.length > 0 && (
          <div className="flex flex-col gap-1 border-t pt-2">
            <ThemedText type="caption" className="text-muted-foreground">Tag friends</ThemedText>
            <div className="flex max-h-40 flex-col gap-0.5 overflow-y-auto">
              {friends.map((friend) => (
                <label
                  key={friend._id}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 hover:bg-muted"
                >
                  <input
                    type="checkbox"
                    checked={form.taggedUserIds.includes(friend._id)}
                    onChange={() => toggleFriend(friend._id)}
                    className="size-4 accent-primary"
                  />
                  <span className="text-sm">{friend.display_name || friend.handle}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
