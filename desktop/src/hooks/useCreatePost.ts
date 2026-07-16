import { useQueryClient } from "@tanstack/react-query";
import { $api } from "@/lib/api/query";

// Create a post; refresh the feed so the new post shows up.
export function useCreatePost() {
  const qc = useQueryClient();
  return $api.useMutation("post", "/v1/user/posts", {
    onSuccess: () => qc.invalidateQueries({ queryKey: ["get", "/v1/user/feed"] }),
  });
}
