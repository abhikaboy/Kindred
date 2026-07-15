import { useState, type JSX } from "react";
import { Link } from "react-router-dom";
import { ThemedText } from "@/components/ThemedText";
import { PostCaption } from "@/components/feed/PostCaption";
import { PostCardMedia } from "@/components/feed/PostCardMedia";
import { ReactionRow } from "@/components/feed/ReactionRow";
import { CommentsThread } from "@/components/feed/CommentsThread";
import { SendKudosModal } from "@/components/notifications/SendKudosModal";
import { useAuth } from "@/contexts/auth";
import {
  useReactToPost,
  useAddComment,
  useDeleteComment,
  type CommentDocumentAPI,
} from "@/hooks/usePostActions";
import { buildReactionGroups, type ReactionGroup } from "@/lib/feed";
import { formatNotificationTime } from "@/lib/notifications";
import type { components } from "@/lib/api/types.gen";

type PostDocumentAPI = components["schemas"]["PostDocumentAPI"];

// Pure optimistic transform: add/remove myId, drop emptied groups, seed new at 1.
function toggleReactionGroups(
  groups: ReactionGroup[],
  emoji: string,
  myId: string
): ReactionGroup[] {
  const existing = groups.find((g) => g.emoji === emoji);
  if (!existing) {
    return [...groups, { emoji, count: 1, ids: [myId], mine: true }];
  }
  const next = groups
    .map((g) => {
      if (g.emoji !== emoji) return g;
      const ids = g.mine ? g.ids.filter((id) => id !== myId) : [...g.ids, myId];
      return { emoji, count: ids.length, ids, mine: !g.mine };
    })
    .filter((g) => g.count > 0);
  return next;
}

export function PostCard({ post }: { post: PostDocumentAPI }): JSX.Element {
  const myId = useAuth().user?._id;
  const { react } = useReactToPost();
  const { addComment } = useAddComment();
  const { deleteComment } = useDeleteComment();

  const [groups, setGroups] = useState<ReactionGroup[]>(() =>
    buildReactionGroups(post.reactions, myId)
  );
  const [comments, setComments] = useState<CommentDocumentAPI[]>(post.comments ?? []);
  const [commentsOpen, setCommentsOpen] = useState(true);
  const [kudosOpen, setKudosOpen] = useState(false);

  const onToggle = (emoji: string) => {
    if (!myId) return;
    const prev = groups;
    setGroups(toggleReactionGroups(prev, emoji, myId));
    react(post._id, emoji).catch(() => setGroups(prev));
  };

  const onAddComment = (content: string) => {
    addComment(post._id, content).then((c) => setComments((prev) => [...prev, c]));
  };

  const onDeleteComment = (commentId: string) => {
    const prev = comments;
    setComments(prev.filter((c) => c.id !== commentId));
    deleteComment(post._id, commentId).catch(() => setComments(prev));
  };

  const createdMs = new Date(post.metadata.createdAt).getTime();
  const kudos = post.kudos ?? [];
  const canSendKudos = !!myId && post.user._id !== myId;

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Link to={`/account/${post.user._id}`} className="shrink-0">
          <img
            src={post.user.profile_picture}
            alt={post.user.display_name}
            className="h-10 w-10 rounded-full object-cover bg-muted"
          />
        </Link>
        <div className="flex flex-col">
          <Link to={`/account/${post.user._id}`} className="hover:underline">
            <ThemedText type="defaultSemiBold" as="span">
              {post.user.display_name}
            </ThemedText>
          </Link>
          <ThemedText type="caption" as="span">
            <span className="text-primary">@{post.user.handle}</span>
            {" · "}
            {formatNotificationTime(createdMs)}
            {post.taggedUsers && post.taggedUsers.length > 0 ? (
              <>
                {" with "}
                {post.taggedUsers.map((t, i) => (
                  <span key={t.id}>
                    {i > 0 ? ", " : ""}
                    <span className="text-primary">@{t.handle}</span>
                  </span>
                ))}
              </>
            ) : null}
          </ThemedText>
        </div>
      </div>

      {post.task ? (
        <ThemedText type="caption" as="p">
          <span className="text-primary">{post.task.category.name}</span>
          {" · "}
          {post.task.content}
        </ThemedText>
      ) : null}

      {post.caption ? <PostCaption caption={post.caption} /> : null}

      <PostCardMedia media={post.media} images={post.images} />

      <ReactionRow
        postId={post._id}
        groups={groups}
        onToggle={onToggle}
        kudos={kudos}
        commentCount={comments.filter((c) => !c.metadata.isDeleted).length}
        commentsOpen={commentsOpen}
        onToggleComments={() => setCommentsOpen((o) => !o)}
        canSendKudos={canSendKudos}
        onSendKudos={() => setKudosOpen(true)}
      />

      {commentsOpen ? (
        <CommentsThread
          comments={comments}
          currentUserId={myId}
          onAdd={onAddComment}
          onDelete={onDeleteComment}
          initialLimit={5}
        />
      ) : null}

      <SendKudosModal
        open={kudosOpen}
        onClose={() => setKudosOpen(false)}
        recipientName={post.user.display_name}
        receiverId={post.user._id}
        kind="congratulation"
        postId={post._id}
        categoryName={post.task?.category.name}
        taskName={post.task?.content}
      />
    </div>
  );
}

export default PostCard;
