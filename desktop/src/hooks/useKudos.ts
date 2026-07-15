import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { $api } from "@/lib/api/query";
import type { components } from "@/lib/api/types.gen";

export type KudosKind = "encouragement" | "congratulation";
export type EncouragementDocument =
  components["schemas"]["EncouragementDocument"];
export type CongratulationDocument =
  components["schemas"]["CongratulationDocument"];

// Types require both auth headers; the client middleware fills the real tokens.
const AUTH = { Authorization: "", refresh_token: "" };

const ENCOURAGEMENTS_KEY = ["get", "/v1/user/encouragements"] as const;
const CONGRATULATIONS_KEY = ["get", "/v1/user/congratulations"] as const;

type KudosDoc = EncouragementDocument | CongratulationDocument;

// Toggle the cached reaction on the matching item across every param variant of the list.
function setReaction(
  qc: QueryClient,
  key: readonly [string, string],
  id: string,
  reaction: string | undefined
): void {
  qc.setQueriesData<KudosDoc[]>({ queryKey: key }, (list) =>
    list?.map((k) => (k.id === id ? { ...k, reaction } : k))
  );
}

// Fetches both received lists.
export function useKudos(): {
  encouragements: EncouragementDocument[];
  congratulations: CongratulationDocument[];
  isLoading: boolean;
  matchKudos: (
    kind: KudosKind,
    senderId: string,
    message: string | undefined,
    timeMs: number
  ) => { id: string; reaction?: string } | undefined;
} {
  const enc = $api.useQuery("get", "/v1/user/encouragements", {
    params: { header: AUTH },
  });
  const con = $api.useQuery("get", "/v1/user/congratulations", {
    params: { header: AUTH },
  });

  const encouragements = enc.data ?? [];
  const congratulations = con.data ?? [];

  // Notifications carry no kudos ID; match back by sender + message, nearest in time.
  const matchKudos = (
    kind: KudosKind,
    senderId: string,
    message: string | undefined,
    timeMs: number
  ): { id: string; reaction?: string } | undefined => {
    const pool: KudosDoc[] =
      kind === "congratulation" ? congratulations : encouragements;
    const candidates = pool.filter(
      (k) => k.sender.id === senderId && (!message || k.message === message)
    );
    if (candidates.length === 0) return undefined;
    return candidates.reduce((best, k) =>
      Math.abs(new Date(k.timestamp).getTime() - timeMs) <
      Math.abs(new Date(best.timestamp).getTime() - timeMs)
        ? k
        : best
    );
  };

  return {
    encouragements,
    congratulations,
    isLoading: enc.isLoading || con.isLoading,
    matchKudos,
  };
}

// Optimistic-toggle reaction on an encouragement, reconciled with the server's reaction.
export function useReactToEncouragement(): {
  react: (id: string, emoji: string) => void;
} {
  const qc = useQueryClient();
  const mutation = $api.useMutation(
    "post",
    "/v1/user/encouragements/{id}/reaction",
    {
      onMutate: async ({ params, body }) => {
        const id = params.path.id;
        await qc.cancelQueries({ queryKey: ENCOURAGEMENTS_KEY });
        const snapshot = qc.getQueriesData<EncouragementDocument[]>({
          queryKey: ENCOURAGEMENTS_KEY,
        });
        const current = snapshot
          .flatMap(([, list]) => list ?? [])
          .find((k) => k.id === id);
        const next = current?.reaction === body.emoji ? undefined : body.emoji;
        setReaction(qc, ENCOURAGEMENTS_KEY, id, next);
        return { snapshot };
      },
      onError: (_err, _vars, ctx) => {
        ctx?.snapshot.forEach(([key, data]) => qc.setQueryData(key, data));
      },
      onSuccess: (data, { params }) => {
        setReaction(qc, ENCOURAGEMENTS_KEY, params.path.id, data.reaction);
      },
    }
  );
  return {
    react: (id, emoji) =>
      mutation.mutate({ params: { header: AUTH, path: { id } }, body: { emoji } }),
  };
}

// Optimistic-toggle reaction on a congratulation, reconciled with the server's reaction.
export function useReactToCongratulation(): {
  react: (id: string, emoji: string) => void;
} {
  const qc = useQueryClient();
  const mutation = $api.useMutation(
    "post",
    "/v1/user/congratulations/{id}/reaction",
    {
      onMutate: async ({ params, body }) => {
        const id = params.path.id;
        await qc.cancelQueries({ queryKey: CONGRATULATIONS_KEY });
        const snapshot = qc.getQueriesData<CongratulationDocument[]>({
          queryKey: CONGRATULATIONS_KEY,
        });
        const current = snapshot
          .flatMap(([, list]) => list ?? [])
          .find((k) => k.id === id);
        const next = current?.reaction === body.emoji ? undefined : body.emoji;
        setReaction(qc, CONGRATULATIONS_KEY, id, next);
        return { snapshot };
      },
      onError: (_err, _vars, ctx) => {
        ctx?.snapshot.forEach(([key, data]) => qc.setQueryData(key, data));
      },
      onSuccess: (data, { params }) => {
        setReaction(qc, CONGRATULATIONS_KEY, params.path.id, data.reaction);
      },
    }
  );
  return {
    react: (id, emoji) =>
      mutation.mutate({ params: { header: AUTH, path: { id } }, body: { emoji } }),
  };
}
