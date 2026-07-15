import { $api } from "@/lib/api/query";
import type { components } from "@/lib/api/types.gen";

export type CommentDocumentAPI = components["schemas"]["CommentDocumentAPI"];
export type UserExtendedReference = components["schemas"]["UserExtendedReference"];
export type MentionInput = components["schemas"]["MentionInput"];

// Types require the auth headers; the client middleware fills the real tokens.
const AUTH = { Authorization: "" };

// Thin mutation wrappers — cards own optimistic local state, so no cache surgery.

export function useReactToPost(): {
  react: (postId: string, emoji: string) => Promise<boolean>;
} {
  const mutation = $api.useMutation("post", "/v1/user/posts/{postId}/reaction");
  return {
    react: async (postId, emoji) => {
      const data = await mutation.mutateAsync({
        params: { header: AUTH, path: { postId } },
        body: { emoji },
      });
      return data.added;
    },
  };
}

export function useAddComment(): {
  addComment: (
    postId: string,
    content: string,
    mentions?: MentionInput[],
    parentId?: string
  ) => Promise<CommentDocumentAPI>;
} {
  const mutation = $api.useMutation("post", "/v1/user/posts/{postId}/comment");
  return {
    addComment: async (postId, content, mentions, parentId) => {
      const data = await mutation.mutateAsync({
        params: { header: AUTH, path: { postId } },
        body: {
          content,
          ...(mentions !== undefined ? { mentions } : {}),
          ...(parentId !== undefined ? { parentId } : {}),
        },
      });
      return data.comment;
    },
  };
}

export function useDeleteComment(): {
  deleteComment: (postId: string, commentId: string) => Promise<void>;
} {
  const mutation = $api.useMutation(
    "delete",
    "/v1/user/posts/{postId}/comment/{commentId}"
  );
  return {
    deleteComment: async (postId, commentId) => {
      await mutation.mutateAsync({
        params: { header: AUTH, path: { postId, commentId } },
      });
    },
  };
}

// Lazy resolver for the who-reacted viewer. Both headers required by the op.
export function useUsersByIds(): {
  fetchUsers: (ids: string[]) => Promise<UserExtendedReference[]>;
} {
  const mutation = $api.useMutation("post", "/v1/users/batch");
  return {
    fetchUsers: async (ids) => {
      if (ids.length === 0) return [];
      const data = await mutation.mutateAsync({
        params: { header: { Authorization: "", refresh_token: "" } },
        body: { userIds: ids },
      });
      return data.users;
    },
  };
}
