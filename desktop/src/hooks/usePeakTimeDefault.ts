import { useState } from "react";
import { $api } from "@/lib/api/query";
import type { ParsedSchedule } from "@shared/taskSuggest";

const OPT_OUT_KEY = "kindred.peakTimeDefault.off";

export type PeakTimeDefault = {
  hour: number;
  label: string;
  reason: string;
  schedule: ParsedSchedule;
};

function formatHour(h: number) {
  const suffix = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12} ${suffix}`;
}

/**
 * The user's peak hour (stated, else inferred behind sample gates) as a default
 * start time for today. Null when there is no pattern, the hour has passed, or
 * the user opted out.
 */
export function usePeakTimeDefault() {
  const [optedOut, setOptedOut] = useState(() => localStorage.getItem(OPT_OUT_KEY) === "1");
  const analytics = $api.useQuery(
    "get",
    "/v1/user/analytics",
    { params: { query: { range: "week" } } },
    { staleTime: 30 * 60 * 1000, enabled: !optedOut },
  );

  const setOff = (off: boolean) => {
    if (off) localStorage.setItem(OPT_OUT_KEY, "1");
    else localStorage.removeItem(OPT_OUT_KEY);
    setOptedOut(off);
  };

  const peak = analytics.data?.peakTime;
  let suggestion: PeakTimeDefault | null = null;
  if (!optedOut && peak) {
    const at = new Date();
    at.setHours(peak.hour, 0, 0, 0);
    if (at.getTime() > Date.now()) {
      const iso = at.toISOString();
      suggestion = {
        hour: peak.hour,
        label: `Today ${formatHour(peak.hour)}`,
        reason: peak.reason,
        schedule: { startDate: iso, startTime: iso, deadline: null },
      };
    }
  }

  return { suggestion, optedOut, setOff };
}
