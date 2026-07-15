import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "@phosphor-icons/react";
import { $api } from "@/lib/api/query";
import { PostCard } from "@/components/feed/PostCard";
import { ThemedText } from "@/components/ThemedText";
import { Skeleton } from "@/components/ui/skeleton";

function BackLink() {
  return (
    <Link
      to="/feed"
      className="flex w-fit items-center gap-1 text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-5" />
    </Link>
  );
}

export default function PostDetailScreen() {
  const { id } = useParams();
  // Header is injected by client middleware; passed empty only to satisfy the typed param.
  const { data, isLoading, error } = $api.useQuery(
    "get",
    "/v1/user/posts/{id}",
    { params: { header: { Authorization: "" }, path: { id: id ?? "" } } },
    { enabled: Boolean(id) }
  );

  if (isLoading) {
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-6 pt-6">
        <Skeleton className="h-5 w-10 rounded-md" />
        <div className="flex flex-col gap-3 rounded-2xl border p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-32 rounded" />
              <Skeleton className="h-3 w-24 rounded" />
            </div>
          </div>
          <Skeleton className="aspect-square w-full rounded-xl" />
          <Skeleton className="h-4 w-3/4 rounded" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-4 pt-6">
        <BackLink />
        <ThemedText type="title" as="h1">
          Post not found
        </ThemedText>
        <ThemedText type="lightBody" className="text-muted-foreground">
          This post may have been deleted or is no longer available.
        </ThemedText>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 pt-6">
      <BackLink />
      <PostCard post={data} />
    </div>
  );
}
