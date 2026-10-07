import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { Icon } from "@phosphor-icons/react";
import { ThemedText } from "@/components/ThemedText";
import { ConcentricRings } from "@/components/rings/ConcentricRings";
import type { components } from "@/lib/api/types.gen";
import { NowPlaying } from "./NowPlaying";
import { PhotoFan } from "./PhotoFan";

const DEFAULT_PICTURE = "https://i.pinimg.com/736x/45/69/cb/4569cb1033f0251fac46f307c3ba495a.jpg";

export type HeroStat = { icon: Icon; value: number; label: string; to?: string };

// Player-card stat: icon carries the meaning, the number the value, the label stays small.
function Stat({ icon: StatIcon, value, label, to }: HeroStat) {
  const body = (
    <>
      <StatIcon size={16} weight="fill" className="text-primary" />
      <ThemedText type="defaultSemiBold" className="tabular-nums">
        {value}
      </ThemedText>
      <ThemedText type="caption" className="text-inherit">
        {label}
      </ThemedText>
    </>
  );
  const cls = "inline-flex items-center gap-1.5 py-1 text-muted-foreground transition-colors duration-150";
  return to ? (
    <Link to={to} className={`${cls} hover:text-foreground`}>
      {body}
    </Link>
  ) : (
    <span className={cls}>{body}</span>
  );
}

/**
 * Shared profile header (own profile and what others see): rings as the level ring
 * around the avatar, one light Fraunces name, now playing, stats, actions, and the
 * latest photos fanned out on the right.
 */
export function ProfileHero({
  userId,
  displayName,
  handle,
  picture,
  rings,
  song,
  stats,
  actions,
  editable,
  showPhotos = true,
}: {
  userId: string;
  displayName: string;
  handle: string;
  picture?: string;
  rings?: components["schemas"]["RingState"] | null;
  song?: components["schemas"]["Song"] | null;
  stats: HeroStat[];
  actions?: ReactNode;
  editable?: boolean;
  showPhotos?: boolean;
}) {
  const hasPhoto = Boolean(picture) && picture !== DEFAULT_PICTURE;
  const avatar = hasPhoto ? (
    <img src={picture} alt="" className="size-[92px] rounded-full object-cover" />
  ) : (
    <div className="size-[92px] rounded-full bg-gradient-to-br from-primary/40 to-muted" />
  );

  return (
    <section className="flex items-center justify-between gap-10 animate-in fade-in slide-in-from-bottom-1 duration-500">
      <div className="flex min-w-0 items-center gap-6">
        <div className="shrink-0">
          {rings ? (
            <ConcentricRings rings={rings} size={148} strokeWidth={6} gap={3} center={avatar} />
          ) : (
            <div className="grid size-[148px] place-items-center">{avatar}</div>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-col">
            <ThemedText type="titleFraunces" as="h1" className="truncate font-medium tracking-[-1.5px]">
              {displayName}
            </ThemedText>
            <ThemedText type="caption">{handle.startsWith("@") ? handle : `@${handle}`}</ThemedText>
          </div>
          <NowPlaying song={song} editable={editable} />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {stats.map((s) => (
              <Stat key={s.label} {...s} />
            ))}
          </div>
          {actions && <div className="mt-1">{actions}</div>}
        </div>
      </div>
      {showPhotos && <PhotoFan userId={userId} />}
    </section>
  );
}
