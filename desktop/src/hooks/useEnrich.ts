import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import client from "@/lib/api/client";
import type { components } from "@/lib/api/types.gen";
import { useAuth } from "@/contexts/auth";

export type EnrichChange = components["schemas"]["EnrichChange"];
export type EnrichStatus = Omit<components["schemas"]["GetEnrichStatusOutputBody"], "$schema">;
export type EnrichPreview = { overview: string; changes: EnrichChange[] };

const AUTH = { Authorization: "" };
const timezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

// Same cadence as mobile: offered on the first eligible day, lingers that day,
// then rests for a week whether or not it was used.
const CYCLE_MS = 7 * 24 * 60 * 60 * 1000;
const offerKey = (userId: string) => `${userId}-auto-enrich-offer`;
type OfferState = { start: number; handled: boolean };
const sameDay = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString();

function readOffer(userId: string): OfferState | null {
  try {
    return JSON.parse(localStorage.getItem(offerKey(userId)) ?? "null");
  } catch {
    return null;
  }
}

export async function fetchEnrichStatus(): Promise<EnrichStatus | null> {
  const { data, error } = await client.GET("/v1/user/tasks/enrich/status", {
    params: { header: AUTH, query: { timezone: timezone() } },
  });
  return error || !data ? null : data;
}

export async function previewEnrich(): Promise<EnrichPreview> {
  const { data, error } = await client.POST("/v1/user/tasks/enrich/preview", {
    params: { header: AUTH },
    body: { timezone: timezone() },
  });
  if (error || !data) throw new Error("Couldn't look over your tasks");
  return { overview: data.overview, changes: data.changes ?? [] };
}

/** Status for the stage offer; `forced` skips the weekly rest (manual entry points). */
export function useEnrichOffer() {
  const { user } = useAuth();
  const userId = user?._id;
  const [status, setStatus] = useState<EnrichStatus | null>(null);
  const [offered, setOffered] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const next = await fetchEnrichStatus();
      if (cancelled || !next) return;
      setStatus(next);
      if (!next.eligible) return;
      const offer = readOffer(userId);
      const now = Date.now();
      const inCycle = offer && now - offer.start < CYCLE_MS;
      if (inCycle && (offer.handled || !sameDay(offer.start, now))) return;
      if (!inCycle) localStorage.setItem(offerKey(userId), JSON.stringify({ start: now, handled: false }));
      setOffered(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const markHandled = useCallback(() => {
    setOffered(false);
    if (userId) localStorage.setItem(offerKey(userId), JSON.stringify({ start: Date.now(), handled: true }));
  }, [userId]);

  return { status, offered, markHandled };
}

export function useApplyEnrich() {
  const qc = useQueryClient();
  return useCallback(
    async (changes: EnrichChange[]) => {
      const { data, error } = await client.POST("/v1/user/tasks/enrich/apply", {
        params: { header: AUTH },
        body: { changes: changes.map((c) => ({ taskId: c.taskId, updates: c.updates })) },
      });
      if (error || !data) throw new Error("Couldn't apply changes");
      qc.invalidateQueries({ queryKey: ["get", "/v1/user/workspaces"] });
      qc.invalidateQueries({ queryKey: ["get", "/v1/tasks/"] });
      return data.tasks ?? [];
    },
    [qc]
  );
}
