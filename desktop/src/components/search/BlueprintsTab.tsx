import { useEffect, useMemo, useState } from "react";
import { SearchBox, type Suggestion } from "@/components/SearchBox";
import { ThemedText } from "@/components/ThemedText";
import { BlueprintCard } from "@/components/BlueprintCard";
import { ExplorePage } from "@/components/search/ExplorePage";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useBlueprintAutocomplete,
  useBlueprintSearch,
  type BlueprintDocument,
} from "@/hooks/useBlueprints";

// Blueprints half of the combined Search page: discover + search blueprints.
export function BlueprintsTab() {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");

  // Debounce the committed query (~300ms) so we don't fire on every keystroke.
  useEffect(() => {
    const id = setTimeout(() => setQuery(input), 300);
    return () => clearTimeout(id);
  }, [input]);

  const hasQuery = query.trim().length > 0;

  const { data: results, isLoading, isFetching } = useBlueprintSearch(query);
  const { data: autocomplete } = useBlueprintAutocomplete(input);

  const suggestions = useMemo<Suggestion[]>(
    () =>
      (autocomplete ?? []).slice(0, 6).map((bp) => ({
        id: bp.id,
        title: bp.name,
        subtitle: bp.category || undefined,
        image: bp.banner || undefined,
      })),
    [autocomplete]
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="max-w-2xl">
        <SearchBox
          value={input}
          onChange={setInput}
          onSubmit={() => setQuery(input)}
          placeholder="Search for a blueprint"
          suggestions={suggestions}
          onSelectSuggestion={(s) => setInput(s.title)}
        />
      </div>

      {hasQuery ? (
        <SearchResults results={results ?? []} loading={isLoading || isFetching} query={query} />
      ) : (
        <ExplorePage />
      )}
    </div>
  );
}

function SearchResults({
  results,
  loading,
  query,
}: {
  results: BlueprintDocument[];
  loading: boolean;
  query: string;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="aspect-[16/10] w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="flex flex-col gap-1 py-12 text-center">
        <ThemedText type="subtitle">No blueprints found</ThemedText>
        <ThemedText type="caption">Nothing matched "{query.trim()}".</ThemedText>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {results.map((bp) => (
        <BlueprintCard key={bp.id} blueprint={bp} />
      ))}
    </div>
  );
}

export default BlueprintsTab;
