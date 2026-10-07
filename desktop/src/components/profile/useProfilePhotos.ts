import { $api } from "@/lib/api/query";

/** Media posts for a profile, newest first; one cached query shared by the fan and the gallery. */
export function useProfilePhotos(userId: string) {
  const query = $api.useQuery("get", "/v1/user/{userId}/posts", {
    params: { header: { Authorization: "" }, path: { userId }, query: { limit: 18 } },
  });
  const photos = (query.data?.posts ?? [])
    .map((post) => ({
      id: post._id,
      thumb: post.media?.[0]?.thumbnailUrl || post.media?.[0]?.url || post.images?.[0],
      isVideo: post.media?.[0]?.type === "video",
      caption: post.caption,
    }))
    // The gallery is media-only; text posts have no thumbnail.
    .filter((p): p is typeof p & { thumb: string } => Boolean(p.thumb));
  return { photos, isLoading: query.isLoading, error: query.error };
}
