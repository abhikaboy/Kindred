import { $api } from "@/lib/api/query";
import { deriveReco, type Reco } from "@/lib/friendActivity";

// Polls a friend's profile for a "live" activity reco; middleware fills auth tokens.
export function useFriendReco(friendId: string): { reco: Reco; isLoading: boolean } {
  const { data, isLoading } = $api.useQuery(
    "get",
    "/v1/user/profiles/{id}",
    { params: { path: { id: friendId } } },
    { refetchInterval: 45000, refetchOnWindowFocus: true, staleTime: 30000 }
  );
  return { reco: deriveReco(data), isLoading };
}
