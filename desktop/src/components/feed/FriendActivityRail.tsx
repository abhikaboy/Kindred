import type { JSX } from "react";
import { ThemedText } from "@/components/ThemedText";
import { Skeleton } from "@/components/ui/skeleton";
import { useFriends } from "@/hooks/useConnections";
import { FriendActivityRow } from "@/components/feed/FriendActivityRow";

export function FriendActivityRail(): JSX.Element {
  const friends = useFriends();
  const list = (friends.data ?? []).slice(0, 12);

  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex items-center gap-2 mb-1">
        <ThemedText type="subtitle">Friend activity</ThemedText>
        <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
      </div>

      {friends.isLoading ? (
        <div>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2.5 py-2">
              <Skeleton className="size-9 rounded-full shrink-0" />
              <div className="flex-1 min-w-0 space-y-1.5">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
          ))}
        </div>
      ) : list.length === 0 ? (
        <ThemedText type="caption">Add friends to see their activity.</ThemedText>
      ) : (
        <div className="divide-y">
          {list.map((f) => (
            <FriendActivityRow key={f._id} friend={f} />
          ))}
        </div>
      )}
    </div>
  );
}
