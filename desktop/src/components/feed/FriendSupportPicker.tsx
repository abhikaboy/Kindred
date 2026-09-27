import type { JSX, ReactElement } from "react";
import { Check, CheckCircle, Circle, Lightning, PencilSimple, Trophy, type Icon } from "@phosphor-icons/react";
import { RING_COLORS } from "@shared/rings";
import { ThemedText } from "@/components/ThemedText";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { FriendSupportOption } from "@/lib/friendActivity";

const VARIANT_ICON: Record<FriendSupportOption["variant"], Icon> = {
  working: Lightning,
  pending: CheckCircle,
  ring: Circle,
  completed: CheckCircle,
  all: Trophy,
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactElement;
  title: string;
  options: FriendSupportOption[];
  isSent: (id: string) => boolean;
  sendingId: string | null;
  onPick: (option: FriendSupportOption) => void;
  onWriteOwn?: () => void;
};

/** Popover listing one-tap kudos suggestions, plus a "Write your own" escape hatch. */
export function FriendSupportPicker({ open, onOpenChange, trigger, title, options, isSent, sendingId, onPick, onWriteOwn }: Props): JSX.Element {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger render={trigger} />
      <PopoverContent side="left" align="start" className="flex w-80 flex-col gap-2 p-3">
        <ThemedText type="defaultSemiBold" className="px-1 text-sm">
          {title}
        </ThemedText>
        {options.map((option) => {
          const sent = isSent(option.id);
          const OptionIcon = VARIANT_ICON[option.variant];
          const color = option.ring ? RING_COLORS[option.ring] : undefined;
          return (
            <button
              key={option.id}
              type="button"
              disabled={sent || !!sendingId}
              onClick={() => onPick(option)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border p-2 text-left transition-colors hover:bg-muted disabled:cursor-default disabled:hover:bg-transparent",
                sent && "opacity-50",
                !sent && !sendingId && "cursor-pointer"
              )}
            >
              <span
                className={cn("grid size-8 shrink-0 place-items-center rounded-full", !color && "bg-primary/10 text-primary")}
                style={color ? { color, backgroundColor: color + "1A" } : undefined}
              >
                <OptionIcon size={16} weight="fill" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <ThemedText className="truncate text-sm">{option.label}</ThemedText>
                <ThemedText type="caption" className="truncate text-xs">
                  {sent ? "Sent" : sendingId === option.id ? "Sending..." : `"${option.message}"`}
                </ThemedText>
              </span>
              {sent ? <Check size={16} weight="bold" className="shrink-0 text-muted-foreground" /> : null}
            </button>
          );
        })}
        {onWriteOwn ? (
          <button
            type="button"
            onClick={onWriteOwn}
            className="flex w-full cursor-pointer items-center gap-3 rounded-xl border p-2 text-left transition-colors hover:bg-muted"
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
              <PencilSimple size={16} />
            </span>
            <ThemedText className="flex-1 text-sm">Write your own</ThemedText>
          </button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
