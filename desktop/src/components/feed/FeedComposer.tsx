import type { JSX } from "react";
import { useAuth } from "@/contexts/auth";
import { ThemedText } from "@/components/ThemedText";
import { useCreate } from "@/components/create/CreateContext";

// Top-of-feed prompt that launches the (globally-mounted) post composer.
export function FeedComposer(): JSX.Element {
  const { user } = useAuth();
  const { openCreatePost } = useCreate();

  return (
    <button
      type="button"
      onClick={() => openCreatePost()}
      className="flex items-center gap-3 rounded-2xl border bg-card p-4 text-left shadow-sm transition-colors hover:bg-muted/40"
    >
      {user?.profile_picture ? (
        <img src={user.profile_picture} alt="" className="h-10 w-10 shrink-0 rounded-full bg-muted object-cover" />
      ) : (
        <div className="h-10 w-10 shrink-0 rounded-full bg-muted" />
      )}
      <ThemedText type="lightBody" className="text-muted-foreground">
        Share something you got done…
      </ThemedText>
    </button>
  );
}

export default FeedComposer;
