import { useState, type JSX } from "react";
import { Button } from "@/components/ui/button";
import { ThemedText } from "@/components/ThemedText";
import { $api } from "@/lib/api/query";

// ponytail: text-only; media compose (GIF/video/confetti) is a follow-up.

// Types require both auth headers; the client middleware fills the real tokens.
const AUTH = { Authorization: "", refresh_token: "" };

type SendKudosModalProps = {
  open: boolean;
  onClose: () => void;
  recipientName: string;
  receiverId: string;
  kind: "encouragement" | "congratulation";
  onSent?: () => void;
  scope?: "task" | "profile";
  taskId?: string;
  taskName?: string;
  categoryName?: string;
  postId?: string;
};

export function SendKudosModal({
  open,
  onClose,
  recipientName,
  receiverId,
  kind,
  onSent,
  scope,
  taskId,
  taskName,
  categoryName,
  postId,
}: SendKudosModalProps): JSX.Element | null {
  const [message, setMessage] = useState("");
  const encouragement = $api.useMutation("post", "/v1/user/encouragements");
  const congratulation = $api.useMutation("post", "/v1/user/congratulations");

  if (!open) return null;

  const submitting = encouragement.isPending || congratulation.isPending;
  const trimmed = message.trim();
  const disabled = trimmed.length === 0 || submitting;

  const handleSuccess = () => {
    setMessage("");
    onSent?.();
    onClose();
  };

  const send = () => {
    if (kind === "encouragement") {
      const resolvedScope = scope ?? "profile";
      encouragement.mutate(
        {
          params: { header: AUTH },
          body: {
            receiver: receiverId,
            message: trimmed,
            scope: resolvedScope,
            type: "message",
            ...(resolvedScope === "task" ? { taskId, taskName, categoryName } : {}),
          },
        },
        { onSuccess: handleSuccess }
      );
    } else {
      congratulation.mutate(
        {
          params: { header: AUTH },
          body: {
            receiver: receiverId,
            message: trimmed,
            categoryName: categoryName ?? "Rings",
            taskName: taskName ?? "Closed all rings",
            type: "message",
            ...(postId ? { postId } : {}),
          },
        },
        { onSuccess: handleSuccess }
      );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <ThemedText type="subtitle" as="h2">
          Send {recipientName} kudos
        </ThemedText>
        <ThemedText type="caption" as="p" className="mt-1">
          A little goes a long way
        </ThemedText>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Write a message..."
          className="mt-4 min-h-24 w-full rounded-xl border bg-background p-3 text-foreground"
        />
        <Button className="mt-4 h-10 w-full" disabled={disabled} onClick={send}>
          {submitting ? "Sending..." : "Send"}
        </Button>
      </div>
    </div>
  );
}

export default SendKudosModal;
