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
