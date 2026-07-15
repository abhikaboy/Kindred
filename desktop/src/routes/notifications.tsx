import { useEffect, useMemo, useRef, useState } from "react";
import { BellRinging } from "@phosphor-icons/react";
import { ThemedText } from "@/components/ThemedText";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth";
import { NotificationItem } from "@/components/notifications/NotificationItem";
import { FollowRequestRow } from "@/components/notifications/FollowRequestRow";
import {
  useNotifications,
  useMarkAllNotificationsRead,
  useFollowRequests,
} from "@/hooks/useNotifications";
import {
  processNotification,
  filterByActivityType,
  groupByTimePeriod,
  FILTER_CHIPS,
  type ActivityFilter,
} from "@/lib/notifications";

// Types require both auth headers; the client middleware fills the real tokens.
const AUTH = { Authorization: "", refresh_token: "" };

export default function NotificationsScreen() {
  const { user } = useAuth();
  const { notifications, unreadCount, isLoading } = useNotifications();
  const followRequests = useFollowRequests();
  const markAllRead = useMarkAllNotificationsRead();
  const [activeChip, setActiveChip] = useState<ActivityFilter>("all");
  const markedRef = useRef(false);

  // Mark everything read once, when the page first shows unread notifications.
  useEffect(() => {
    if (!isLoading && unreadCount > 0 && !markedRef.current) {
      markedRef.current = true;
      markAllRead.mutate({ params: { header: AUTH } });
    }
  }, [isLoading, unreadCount, markAllRead]);

  const processed = useMemo(
    () =>
      notifications
        .map((n) => processNotification(n, user?._id))
        .filter((n): n is NonNullable<typeof n> => n !== null),
    [notifications, user?._id]
  );

  const groups = useMemo(
    () => groupByTimePeriod(filterByActivityType(processed, activeChip)),
    [processed, activeChip]
  );

  const requests = followRequests.data ?? [];

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 pt-6">
      <ThemedText type="titleFraunces" as="h1">
        Notifications
      </ThemedText>

      {requests.length > 0 && (
        <section className="flex flex-col gap-3">
          <ThemedText type="subtitle" as="h2">
            Requests
          </ThemedText>
          <div className="flex flex-col gap-3">
            {requests.map((r) => (
              <FollowRequestRow key={r.id} request={r} />
            ))}
          </div>
        </section>
      )}

      <div className="flex flex-wrap gap-2">
        {FILTER_CHIPS.map((chip) => {
          const active = activeChip === chip.id;
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => setActiveChip(chip.id)}
              className={cn(
                "rounded-full border px-4 py-2 transition-colors",
                active ? "border-transparent bg-primary" : "border-border hover:bg-muted"
              )}
            >
              <ThemedText
                type="caption"
                className={active ? "text-primary-foreground" : "text-foreground"}
              >
                {chip.label}
              </ThemedText>
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      ) : processed.length === 0 ? (
        <EmptyState
          icon={BellRinging}
          title="No notifications yet"
          description="When friends cheer you on or react to your posts, it'll show up here."
        />
      ) : groups.length === 0 ? (
        <ThemedText type="caption" className="py-8 text-center">
          No notifications match this filter
        </ThemedText>
      ) : (
        groups.map((group) => (
          <section key={group.title} className="flex flex-col gap-3">
            <ThemedText type="subtitle" as="h2">
              {group.title}
            </ThemedText>
            <div className="flex flex-col gap-3">
              {group.data.map((n) => (
                <NotificationItem key={n.id} notification={n} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
