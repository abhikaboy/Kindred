import { Link, useLocation } from "react-router-dom";
import { Bell } from "@phosphor-icons/react";
import { useNotifications } from "@/hooks/useNotifications";
import { cn } from "@/lib/utils";

// Bell in the top-right of the app header. Replaces the old sidebar nav entry.
export function NotificationBell() {
  const { unreadCount } = useNotifications();
  const { pathname } = useLocation();
  const active = pathname === "/notifications";
  const hasUnread = unreadCount > 0;

  return (
    <Link
      to="/notifications"
      aria-label={hasUnread ? `Notifications, ${unreadCount} unread` : "Notifications"}
      className={cn(
        "relative grid size-9 place-items-center rounded-full text-foreground transition-colors hover:bg-muted",
        active && "bg-muted"
      )}
    >
      <Bell size={20} weight={active || hasUnread ? "fill" : "regular"} />
      {hasUnread ? (
        <span className="absolute -right-0.5 -top-0.5 grid min-h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-sidebar">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      ) : null}
    </Link>
  );
}

export default NotificationBell;
