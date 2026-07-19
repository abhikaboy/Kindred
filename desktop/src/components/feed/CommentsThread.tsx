import { useState, type JSX, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { Trash } from "@phosphor-icons/react";
import { ThemedText } from "@/components/ThemedText";
import { segmentCaption } from "@/lib/feed";
import { formatNotificationTime } from "@/lib/notifications";
import type { CommentDocumentAPI } from "@/hooks/usePostActions";

type CommentsThreadProps = {
  comments: CommentDocumentAPI[];
  currentUserId?: string;
  onAdd: (content: string) => void;
  onDelete: (commentId: string) => void;
  /** Show only the most recent N until "view all" is clicked. */
  initialLimit?: number;
};

export function CommentsThread({
  comments,
  currentUserId,
  onAdd,
  onDelete,
  initialLimit,
}: CommentsThreadProps): JSX.Element {
  const [draft, setDraft] = useState("");
  const [showAll, setShowAll] = useState(false);

  const submit = () => {
    const trimmed = draft.trim();
    if (trimmed.length === 0) return;
    onAdd(trimmed);
    setDraft("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  };

  const visible = comments.filter((c) => !c.metadata.isDeleted);
  const truncated = initialLimit != null && !showAll && visible.length > initialLimit;
  const shown = truncated ? visible.slice(-initialLimit!) : visible;

  return (
    <div className="mt-3 border-t pt-3 flex flex-col gap-3">
      {truncated ? (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="self-start text-sm text-muted-foreground hover:text-foreground cursor-pointer"
        >
          View all {visible.length} comments
        </button>
      ) : null}
      {shown.map((comment) => {
        const mine = !!currentUserId && comment.user._id === currentUserId;
        return (
          <div key={comment.id} className="group flex items-start gap-2">
            <Link to={`/account/${comment.user._id}`} className="shrink-0">
              <img
                src={comment.user.profile_picture}
                alt={comment.user.display_name}
                className="h-7 w-7 rounded-full object-cover bg-muted"
              />
            </Link>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <ThemedText type="defaultSemiBold" as="span" className="text-sm">
                  {comment.user.display_name}
                </ThemedText>
                <ThemedText type="caption" as="span">
                  {formatNotificationTime(new Date(comment.metadata.createdAt).getTime())}
                </ThemedText>
                {mine ? (
                  <button
                    type="button"
                    aria-label="Delete comment"
                    onClick={() => onDelete(comment.id)}
                    className="ml-auto text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 cursor-pointer"
                  >
                    <Trash size={16} />
                  </button>
                ) : null}
              </div>
              <ThemedText type="default" as="p" className="text-sm whitespace-pre-wrap break-words">
                {segmentCaption(comment.content).map((seg, i) => (
                  <span key={i} className={seg.mention ? "text-primary" : "text-foreground"}>
                    {seg.text}
                  </span>
                ))}
              </ThemedText>
            </div>
          </div>
        );
      })}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Add a comment..."
        className="mt-2 w-full flex-1 rounded-full border bg-background px-5 py-3.5 text-sm text-foreground outline-none transition-colors focus:border-primary"
      />
    </div>
  );
}

export default CommentsThread;
