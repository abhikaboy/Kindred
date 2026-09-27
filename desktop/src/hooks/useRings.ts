import type { UseQueryResult } from "@tanstack/react-query";
import { $api } from "@/lib/api/query";
import type { components } from "@/lib/api/types.gen";

export type RingTodayResponse = components["schemas"]["GetTodayResponseBody"];
export type RingProgress = components["schemas"]["RingProgress"];

// Today's ring state + score. Authorization is injected by the client middleware;
// passed empty only to satisfy the typed param (this op omits the header in codegen).
export function useRingsToday(): UseQueryResult<RingTodayResponse> {
  return $api.useQuery("get", "/v1/user/rings/today", {
    params: { header: { Authorization: "" } },
  } as never) as UseQueryResult<RingTodayResponse>;
}

export type RingState = components["schemas"]["RingState"];

// Last 7 days of ring state, for the per-ring history strip.
export function useRingsHistory(): UseQueryResult<components["schemas"]["GetHistoryResponseBody"]> {
  return $api.useQuery("get", "/v1/user/rings/history", {
    params: { query: { days: 7 } },
  } as never) as UseQueryResult<components["schemas"]["GetHistoryResponseBody"]>;
}
