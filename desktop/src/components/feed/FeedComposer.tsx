import { useState, type JSX } from "react";
import { useAuth } from "@/contexts/auth";
import { ThemedText } from "@/components/ThemedText";
import { CreatePostModal } from "@/components/feed/CreatePostModal";

// Top-of-feed prompt that launches the post composer.
export function FeedComposer(): JSX.Element {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
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
      <CreatePostModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export default FeedComposer;
