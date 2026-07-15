import { Link } from "react-router-dom";
import { Images, Play } from "@phosphor-icons/react";
import { $api } from "@/lib/api/query";
import { ThemedText } from "@/components/ThemedText";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";

export function ProfileGallery({ userId }: { userId: string }) {
    const { data, isLoading, error } = $api.useQuery("get", "/v1/user/{userId}/posts", {
        params: { header: { Authorization: "" }, path: { userId }, query: { limit: 18 } },
    });

    if (isLoading) {
        return (
            <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="aspect-square rounded-lg" />
                ))}
            </div>
        );
    }

    if (error) {
        return <ThemedText type="caption">Couldn’t load posts.</ThemedText>;
    }

    const posts = data?.posts ?? [];
    const thumbOf = (post: (typeof posts)[number]) =>
        post.media?.[0]?.thumbnailUrl || post.media?.[0]?.url || post.images?.[0];

    // The gallery is media-only — text posts have no thumbnail and are skipped.
    const gallery = posts.filter((p) => thumbOf(p));
    if (gallery.length === 0) {
        return (
            <EmptyState
                icon={Images}
                title="No posts yet"
                description="Photos and videos will appear here."
            />
        );
    }

    return (
        <div className="grid grid-cols-3 gap-2">
            {gallery.map((post) => {
                const thumb = thumbOf(post);
                const isVideo = post.media?.[0]?.type === "video";
                return (
                    <Link
                        key={post._id}
                        to={`/post/${post._id}`}
                        className="relative aspect-square overflow-hidden rounded-lg bg-secondary transition-opacity hover:opacity-90"
                    >
                        <img
                            src={thumb}
                            alt={post.caption}
                            loading="lazy"
                            className="size-full object-cover"
                        />
                        {isVideo && (
                            <Play weight="fill" className="absolute right-2 top-2 size-4 text-white drop-shadow" />
                        )}
                    </Link>
                );
            })}
        </div>
    );
}
