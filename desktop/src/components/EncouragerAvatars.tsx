import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import type { components } from "@/lib/api/types.gen";

type TaskKudos = components["schemas"]["TaskKudos"];

const MAX = 3;

// Overlapping stack of the people who encouraged a task — mirrors mobile's 22px
// avatar row (EncouragerAvatars). Falls back to a solid primary circle if a
// sender has no picture.
export function EncouragerAvatars({ encouragements }: { encouragements: TaskKudos[] }) {
  const shown = encouragements.slice(0, MAX);
  return (
    <div className="flex items-center">
      {shown.map((e, i) => {
        const base = "size-[22px] shrink-0 rounded-full bg-primary ring-2 ring-background";
        // Overlap + stacking live on the flex child so the wrapping Link pulls left too.
        const wrap = cn("shrink-0", i > 0 && "-ml-2");
        const z = { zIndex: shown.length - i };
        const dot = e.sender.icon ? (
          <img src={e.sender.icon} alt={e.sender.name} className={cn(base, "object-cover")} />
        ) : (
          <span className={base} />
        );
        return e.sender.id ? (
          <Link
            key={e.encouragementId}
            to={`/account/${e.sender.id}`}
            onClick={(ev) => ev.stopPropagation()}
            className={wrap}
            style={z}
          >
            {dot}
          </Link>
        ) : (
          <span key={e.encouragementId} className={wrap} style={z}>
            {dot}
          </span>
        );
      })}
    </div>
  );
}

export default EncouragerAvatars;
