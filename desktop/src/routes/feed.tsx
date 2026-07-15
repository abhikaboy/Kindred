import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Handshake } from "@phosphor-icons/react";
import { ThemedText } from "@/components/ThemedText";
import { Skeleton } from "@/components/ui/skeleton";
import { useFeed } from "@/hooks/useFeed";
import { PostCard } from "@/components/feed/PostCard";
import { TaskFeedCard } from "@/components/feed/TaskFeedCard";
import { RingsClosedFeedCard } from "@/components/feed/RingsClosedFeedCard";
import { FriendActivityRail } from "@/components/feed/FriendActivityRail";

export default function FeedScreen() {
  const { items, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useFeed();
  const sentinel = useRef<HTMLDivElement>(null);

  // Infinite scroll: fetch the next page when the bottom sentinel scrolls into view.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !isFetchingNextPage) fetchNextPage();
    });
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div className="flex gap-6 pt-6">
      {/* Feed centered in the remaining space; the rail is pinned to the right edge. */}
      <div className="min-w-0 flex-1">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          <ThemedText type="titleFraunces" as="h1">
            Feed
          </ThemedText>

          {isLoading ? (
            <div className="flex flex-col gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-64 w-full rounded-2xl" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <Handshake size={40} weight="duotone" className="text-primary" />
              <ThemedText type="subtitle" as="h2">
                It's quiet… too quiet
              </ThemedText>
              <ThemedText type="caption" className="max-w-xs">
                When your friends complete tasks and share updates, they'll show up here.
              </ThemedText>
              <Link to="/search" className="text-primary hover:underline">
                Find friends
              </Link>
            </div>
          ) : (
            <>
              {items.map((item, i) => {
                if (item.type === "post" && item.post) {
                  return <PostCard key={item.post._id} post={item.post} />;
                }
                if (item.type === "task" && item.task) {
                  return <TaskFeedCard key={`task-${item.task.id}`} task={item.task} />;
                }
                if (item.type === "rings_closed" && item.ringsClosed) {
                  return (
                    <RingsClosedFeedCard key={`rings-${item.ringsClosed.id}`} ringsClosed={item.ringsClosed} />
                  );
                }
                return <div key={i} hidden />;
              })}

              <div ref={sentinel} className="h-1" />
              {isFetchingNextPage && (
                <div className="flex flex-col gap-4">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <Skeleton key={i} className="h-64 w-full rounded-2xl" />
                  ))}
                </div>
              )}
              {!hasNextPage && (
                <ThemedText type="caption" className="py-6 text-center">
                  You've reached the end 🎉
                </ThemedText>
              )}
            </>
          )}
        </div>
      </div>

      <aside className="hidden w-80 shrink-0 lg:block">
        <div className="sticky top-6">
          <FriendActivityRail />
        </div>
      </aside>
    </div>
  );
}
