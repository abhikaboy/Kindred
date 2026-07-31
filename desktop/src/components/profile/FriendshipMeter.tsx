import type { JSX } from "react";
import { Heart } from "@phosphor-icons/react";
import {
    FRIENDSHIP_ACTIONS,
    MAX_FRIENDSHIP_LEVEL,
    friendshipLevel,
    friendshipProgress,
} from "@shared/friendship";
import { ThemedText } from "@/components/ThemedText";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Compact friendship level + progress to the next level. Only shown for friends.
export function FriendshipMeter({ score, name }: { score: number; name: string }): JSX.Element {
    const level = friendshipLevel(score);
    const next = level.next;
    const pct = Math.round(friendshipProgress(score) * 100);

    return (
        <Popover>
            <PopoverTrigger
                openOnHover
                className="flex w-full max-w-64 cursor-pointer flex-col gap-1.5 text-left transition-opacity hover:opacity-70"
            >
                <span className="flex w-full items-center gap-1.5">
                    <Heart size={13} weight="fill" className="shrink-0 text-primary" />
                    <ThemedText type="defaultSemiBold" className="text-sm">
                        {level.name}
                    </ThemedText>
                    <ThemedText type="caption" className="ml-auto text-xs">
                        {score}
                    </ThemedText>
                </span>
                <span className="block h-1 w-full overflow-hidden rounded-full bg-border">
                    <span
                        className="block h-full rounded-full bg-primary transition-[width] duration-500"
                        style={{ width: `${pct}%` }}
                    />
                </span>
                <ThemedText type="caption" className="text-xs">
                    {next === null ? "Highest level" : `${next - score} to ${friendshipLevel(next).name.toLowerCase()}`}
                </ThemedText>
            </PopoverTrigger>

            <PopoverContent className="w-72 p-3.5">
                <ThemedText type="defaultSemiBold" as="p" className="text-sm">
                    Your friendship with {name}
                </ThemedText>
                <ThemedText type="caption" as="p" className="mt-0.5 text-xs">
                    Level {level.level} of {MAX_FRIENDSHIP_LEVEL} · Showing up for each other grows this.
                </ThemedText>
                <ul className="mt-3 flex flex-col gap-1.5">
                    {FRIENDSHIP_ACTIONS.map((action) => (
                        <li key={action.label} className="flex items-center justify-between gap-3">
                            <ThemedText type="caption" className="text-xs text-foreground">
                                {action.label}
                            </ThemedText>
                            <ThemedText type="caption" className="shrink-0 text-xs text-primary">
                                +{action.points}
                            </ThemedText>
                        </li>
                    ))}
                </ul>
            </PopoverContent>
        </Popover>
    );
}
