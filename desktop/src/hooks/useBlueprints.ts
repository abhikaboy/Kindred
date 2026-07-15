import type { UseQueryResult } from "@tanstack/react-query";
import { $api } from "@/lib/api/query";
import type { components } from "@/lib/api/types.gen";

export type BlueprintDocument = components["schemas"]["BlueprintDocument"];
export type BlueprintCategoryGroup =
  components["schemas"]["BlueprintCategoryGroup"];

// Blueprints grouped by category — the empty-state browse view. Auth is injected by
// the client middleware; these ops omit the header in codegen, so no param is needed.
export function useBlueprintsByCategory(): UseQueryResult<
  BlueprintCategoryGroup[]
> {
  return $api.useQuery(
    "get",
    "/v1/blueprints/by-category"
  ) as UseQueryResult<BlueprintCategoryGroup[]>;
}

// Full-text blueprint search; disabled until the query has non-whitespace content.
export function useBlueprintSearch(
  query: string
): UseQueryResult<BlueprintDocument[]> {
  const trimmed = query.trim();
  return $api.useQuery(
    "get",
    "/v1/blueprints/search",
    { params: { query: { query: trimmed } } },
    { enabled: trimmed.length > 0 }
  ) as UseQueryResult<BlueprintDocument[]>;
}

// Lightweight suggestions for the search dropdown; disabled under 2 chars.
export function useBlueprintAutocomplete(
  query: string
): UseQueryResult<BlueprintDocument[]> {
  const trimmed = query.trim();
  return $api.useQuery(
    "get",
    "/v1/blueprints/autocomplete",
    { params: { query: { query: trimmed } } },
    { enabled: trimmed.length >= 2 }
  ) as UseQueryResult<BlueprintDocument[]>;
}
