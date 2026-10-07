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
      className="flex items-center gap-3 rounded-full bg-card py-2 pl-2 pr-5 text-left shadow-[0_1px_2px_rgba(0,0,0,0.03),0_8px_28px_-14px_rgba(0,0,0,0.12)] transition-shadow duration-200 hover:shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_-12px_rgba(0,0,0,0.18)]"
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
