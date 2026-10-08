import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ThemedText } from "@/components/ThemedText";
import { useFriends } from "@/hooks/useConnections";
import { useFriendProfiles } from "@/hooks/useFriendProfiles";
import { useRingsToday } from "@/hooks/useRings";

const MAX_FRIENDS = 24;

const isToday = (iso?: string) => !!iso && new Date(iso).toDateString() === new Date().toDateString();

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

// Light comparison: only names friends who closed Plan today; renders nothing otherwise.
export function FriendsClosedToday() {
  const friends = useFriends();
  const list = useMemo(() => (friends.data ?? []).slice(0, MAX_FRIENDS), [friends.data]);
  const { profiles } = useFriendProfiles(list.map((f) => f._id));
  const mine = useRingsToday();

  const closed = list.filter((_, i) => {
    const rings = profiles[i]?.ring_state;
    return rings?.plan.closed && isToday(rings.date);
  });
  if (closed.length === 0) return null;

  const youToo = !!mine.data?.ring_state?.plan.closed;
  const n = closed.length;
  const sentence = youToo
    ? n === 1
      ? `You and ${closed[0].display_name} both closed Plan today.`
      : `You and ${n} friends closed Plan today.`
    : n === 1
      ? `${closed[0].display_name} closed Plan today.`
      : `${n} friends closed Plan today.`;
  const names = joinNames(closed.slice(0, 4).map((f) => f.display_name)) + (n > 4 ? ` and ${n - 4} more` : "");

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center">
        {closed.slice(0, 6).map((f) => (
          <Link
            key={f._id}
            to={`/account/${f._id}`}
            title={f.display_name}
            className="-ml-2 first:ml-0 rounded-full ring-2 ring-background transition-transform hover:-translate-y-0.5"
          >
            {f.profile_picture ? (
              <img src={f.profile_picture} alt="" className="size-9 rounded-full bg-muted object-cover" />
            ) : (
              <span className="flex size-9 items-center justify-center rounded-full bg-primary/15 text-sm text-primary">
                {f.display_name.charAt(0)}
              </span>
            )}
          </Link>
        ))}
      </div>
      <div className="flex flex-col gap-1">
        <ThemedText type="larger_default">{sentence}</ThemedText>
        {n > 1 || !youToo ? <ThemedText type="caption">{names}</ThemedText> : null}
      </div>
    </section>
  );
}
