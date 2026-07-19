import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent, type JSX } from "react";
import { toast } from "sonner";
import { Gif, ImageSquare, X } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { ThemedText } from "@/components/ThemedText";
import { $api } from "@/lib/api/query";
import { uploadImage } from "@/lib/upload";
import { GifPicker } from "@/components/kudos/GifPicker";
import { RingsCelebration } from "@/components/kudos/RingsCelebration";

// Types require both auth headers; the client middleware fills the real tokens.
const AUTH = { Authorization: "", refresh_token: "" };

function pickImageFile(items: DataTransferItemList | FileList | null): File | null {
  if (!items) return null;
  for (const item of Array.from(items as ArrayLike<DataTransferItem | File>)) {
    const file = "getAsFile" in item ? item.getAsFile() : (item as File);
    if (file && file.type.startsWith("image/")) return file;
  }
  return null;
}

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
  showRings?: boolean;
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
  showRings,
}: SendKudosModalProps): JSX.Element | null {
  const [message, setMessage] = useState("");
  const [media, setMedia] = useState<string | null>(null); // image/GIF url when set
  const [showGif, setShowGif] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const encouragement = $api.useMutation("post", "/v1/user/encouragements");
  const congratulation = $api.useMutation("post", "/v1/user/congratulations");

  useEffect(() => {
    if (!open) {
      setMessage("");
      setMedia(null);
      setShowGif(false);
      setUploading(false);
    }
  }, [open]);

  if (!open) return null;

  const submitting = encouragement.isPending || congratulation.isPending;
  const content = media ?? message.trim();
  const disabled = content.length === 0 || submitting || uploading;

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    setShowGif(false);
    try {
      const url = await uploadImage(file, kind, `${kind}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      setMedia(url);
    } catch (err) {
      if (err instanceof Error) toast.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  const onPaste = (e: ClipboardEvent) => {
    const img = pickImageFile(e.clipboardData.items);
    if (img) void handleFile(img);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    const img = pickImageFile(e.dataTransfer.files);
    if (img) void handleFile(img);
  };

  const handleSuccess = () => {
    onSent?.();
    onClose();
  };

  const send = () => {
    const type = media ? "image" : "message";
    if (kind === "encouragement") {
      const resolvedScope = scope ?? "profile";
      encouragement.mutate(
        {
          params: { header: AUTH },
          body: {
            receiver: receiverId,
            message: content,
            scope: resolvedScope,
            type,
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
            message: content,
            categoryName: categoryName ?? "Rings",
            taskName: taskName ?? "Closed all rings",
            type,
            ...(postId ? { postId } : {}),
          },
        },
        { onSuccess: handleSuccess }
      );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-in fade-in-0 duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-[0_1px_8px_rgba(0,0,0,0.12)] animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2 duration-200"
        onClick={(e) => e.stopPropagation()}
        onPaste={onPaste}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
      >
        {showRings ? (
          <div className="mb-4">
            <RingsCelebration />
          </div>
        ) : null}
        <ThemedText type="subtitle" as="h2">
          Send {recipientName} kudos
        </ThemedText>
        <ThemedText type="caption" as="p" className="mt-1">
          A little goes a long way
        </ThemedText>

        {taskName ? (
          <div className="mt-3 rounded-xl border bg-background px-3 py-2">
            {categoryName ? (
              <ThemedText type="caption" className="block text-primary">
                {categoryName}
              </ThemedText>
            ) : null}
            <ThemedText type="defaultSemiBold" className="block text-sm">
              {taskName}
            </ThemedText>
          </div>
        ) : null}

        {media ? (
          <div className="relative mt-4">
            <img src={media} alt="" className="max-h-64 w-full rounded-xl object-cover" />
            <button
              type="button"
              aria-label="Remove image"
              onClick={() => setMedia(null)}
              className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80"
            >
              <X size={16} weight="bold" />
            </button>
          </div>
        ) : (
          <>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write a message, paste an image, or add a GIF…"
              className="mt-4 min-h-32 w-full rounded-xl border bg-background p-4 text-foreground outline-none focus:border-primary transition-colors resize-y"
            />
            <div className="mt-2 flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={uploading} onClick={() => fileInput.current?.click()}>
                <ImageSquare weight="regular" /> {uploading ? "Uploading…" : "Image"}
              </Button>
              <Button variant={showGif ? "secondary" : "outline"} size="sm" onClick={() => setShowGif((s) => !s)}>
                <Gif weight="regular" /> GIF
              </Button>
            </div>
            {showGif ? (
              <div className="mt-3">
                <GifPicker
                  onSelect={(url) => {
                    setMedia(url);
                    setShowGif(false);
                  }}
                />
              </div>
            ) : null}
          </>
        )}

        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
        />

        <Button className="mt-4 h-10 w-full" disabled={disabled} onClick={send}>
          {submitting ? "Sending…" : "Send"}
        </Button>
      </div>
    </div>
  );
}

export default SendKudosModal;
