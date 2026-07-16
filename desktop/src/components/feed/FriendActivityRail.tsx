import type { JSX } from "react";
import { Link } from "react-router-dom";
import { ThemedText } from "@/components/ThemedText";
import { Skeleton } from "@/components/ui/skeleton";
import { useFriends } from "@/hooks/useConnections";
import { FriendActivityRow } from "@/components/feed/FriendActivityRow";

// A calm, progress-focused companion to the feed — shows what friends are
// actively working on right now. Borderless + sticky so it reads as part of the
// page rather than a widget hovering off to the side.
export function FriendActivityRail(): JSX.Element {
  const friends = useFriends();
  const list = (friends.data ?? []).slice(0, 12);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 px-1">
        <ThemedText type="defaultSemiBold" className="text-sm uppercase tracking-wide text-muted-foreground">
          Active now
        </ThemedText>
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
      </div>

      <div className="rounded-2xl bg-muted/40 p-2">
        {friends.isLoading ? (
          <div className="flex flex-col">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2.5 px-2 py-2">
                <Skeleton className="size-9 rounded-full shrink-0" />
                <div className="flex-1 min-w-0 space-y-1.5">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            ))}
          </div>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-start gap-1 px-2 py-3">
            <ThemedText type="caption">No friends yet.</ThemedText>
            <Link to="/search" className="text-sm text-primary hover:underline">
              Find people you know
            </Link>
          </div>
        ) : (
          <div className="flex flex-col">
            {list.map((f) => (
              <div key={f._id} className="rounded-xl px-2 transition-colors hover:bg-background/60">
                <FriendActivityRow friend={f} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
