import { useEffect, useState } from "react";
import { Handshake } from "@phosphor-icons/react";
import { ThemedText } from "@/components/ThemedText";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
import { SearchBox } from "@/components/SearchBox";
import { SectionHeader } from "@/components/home/SectionHeader";
import { UserRow } from "@/components/friends/UserRow";
import { RequestRow } from "@/components/friends/RequestRow";
import { SuggestedCard } from "@/components/friends/SuggestedCard";
import { SearchResultRow } from "@/components/friends/SearchResultRow";
import {
  useFriends,
  useReceivedRequests,
  useSuggestedUsers,
  useProfileSearch,
} from "@/hooks/useConnections";

// Debounces a value by the given delay (ms).
function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function RowSkeletons({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

// People search on Together; when idle, shows requests, the Together sections (children), suggested, then friends.
export function PeopleTab({ chips, children }: { chips?: React.ReactNode; children?: React.ReactNode }) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounced(query.trim(), 300);
  const searching = debouncedQuery.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <SearchBox value={query} onChange={setQuery} placeholder="Search people by name or handle" autoFocus />
        {chips}
      </div>

      {searching ? <SearchSection query={debouncedQuery} /> : <BrowseSections>{children}</BrowseSections>}
    </div>
  );
}

function SearchSection({ query }: { query: string }) {
  const { data, isLoading } = useProfileSearch(query);
  const results = data ?? [];

  if (isLoading) return <RowSkeletons />;

  if (results.length === 0) {
    return (
      <ThemedText type="caption" className="py-8 text-center">
        No people found for "{query}"
      </ThemedText>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {results.map((profile) => (
        <SearchResultRow key={profile.id} profile={profile} />
      ))}
    </div>
  );
}

function BrowseSections({ children }: { children?: React.ReactNode }) {
  const friends = useFriends();
  const requests = useReceivedRequests();
  const suggested = useSuggestedUsers();

  const requestItems = requests.data ?? [];
  const suggestedItems = suggested.data ?? [];
  const friendItems = friends.data ?? [];

  return (
    <div className="flex flex-col gap-12">
      {requestItems.length > 0 && (
        <section className="flex flex-col gap-4">
          <SectionHeader title={`Requests · ${requestItems.length}`} />
          <div className="flex flex-col gap-3">
            {requestItems.map((r) => (
              <RequestRow key={r.id} request={r} />
            ))}
          </div>
        </section>
      )}

      {children}

      {suggestedItems.length > 0 && (
        <section className="flex flex-col gap-4">
          <SectionHeader title="Suggested" />
          <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2 [mask-image:linear-gradient(to_right,black_88%,transparent)] [scrollbar-width:none]">
            {suggestedItems.map((u) => (
              <SuggestedCard key={u._id} user={u} />
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-4">
        <SectionHeader title={friendItems.length ? `Friends · ${friendItems.length}` : "Friends"} />
        {friends.isLoading ? (
          <RowSkeletons />
        ) : friendItems.length === 0 ? (
          <EmptyState
            icon={Handshake}
            title="No friends yet"
            description="Add friends to see their rings and cheer them on as they get things done. Search above to find people you know."
          />
        ) : (
          <div className="flex flex-col gap-3">
            {friendItems.map((f) => (
              <UserRow
                key={f._id}
                userId={f._id}
                displayName={f.display_name}
                handle={f.handle}
                profilePicture={f.profile_picture}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default PeopleTab;
