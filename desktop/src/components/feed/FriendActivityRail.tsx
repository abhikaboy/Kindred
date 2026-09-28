import { useMemo, type JSX } from "react";
import { Link } from "react-router-dom";
import { ThemedText } from "@/components/ThemedText";
import { Skeleton } from "@/components/ui/skeleton";
import { useFriends } from "@/hooks/useConnections";
import { useFriendProfiles } from "@/hooks/useFriendProfiles";
import { FriendActivityRow } from "@/components/feed/FriendActivityRow";
import { getActivity, groupByActivity } from "@/lib/friendActivity";

const MAX_FRIENDS = 12;

// Desktop mirror of mobile's Friends page: who's working now, who finished
// earlier today, then everyone else, with one-tap nudges and congratulations.
export function FriendActivityRail(): JSX.Element {
  const friends = useFriends();
  const list = useMemo(() => (friends.data ?? []).slice(0, MAX_FRIENDS), [friends.data]);
  const { profiles } = useFriendProfiles(list.map((f) => f._id));

  const sections = groupByActivity(
    list.map((friend, i) => ({ friend, profile: profiles[i], activity: getActivity(profiles[i]) }))
  );

  return (
    <div className="flex flex-col gap-3">
      <ThemedText type="larger_default" className="px-2">
        Friends
      </ThemedText>

      <div>
        {friends.isLoading ? (
          <div className="flex flex-col">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-2 py-2">
                <Skeleton className="size-9 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-2">
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
          <div className="flex flex-col gap-1">
            {sections.map((section) => (
              <div key={section.kind} className="flex flex-col">
                {section.title ? (
                  <div className="flex items-center gap-2 px-2 pt-2">
                    <ThemedText type="caption">
                      {section.title}
                    </ThemedText>
                    {section.kind === "working" ? (
                      <span className="inline-block size-1.5 animate-pulse rounded-full bg-emerald-500" />
                    ) : null}
                  </div>
                ) : null}
                {section.data.map(({ friend, profile, activity }) => (
                  <div key={friend._id} className="rounded-xl px-2 transition-colors hover:bg-muted/60">
                    <FriendActivityRow friend={friend} profile={profile} activity={activity} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
