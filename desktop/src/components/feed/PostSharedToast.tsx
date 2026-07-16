import { toast } from "sonner";
import { CaretRight } from "@phosphor-icons/react";
import { ThemedText } from "@/components/ThemedText";

const DURATION = 6000;

// What we render in the preview — everything is known client-side at share time
// (auth user + the caption/task/image we just posted), so no server round-trip.
export type SharedPostPreview = {
  authorName: string;
  authorAvatar?: string;
  taskLabel?: string;
  caption?: string;
  image?: string;
};

// After sharing, instead of a plain "Shared to your feed" success toast, slide in
// a mini preview of the just-created post with a "click to see" jump into the feed.
export function showPostSharedToast({
  preview,
  onView,
}: {
  preview: SharedPostPreview;
  onView: () => void;
}): void {
  toast.custom(
    (id) => (
      <button
        type="button"
        onClick={() => {
          onView();
          toast.dismiss(id);
        }}
        className="task-toast-in flex w-[360px] max-w-[90vw] flex-col overflow-hidden rounded-xl border bg-card text-left shadow-lg transition-transform hover:scale-[1.01]"
      >
        <div className="flex items-center justify-between px-4 pt-3">
          <ThemedText type="smallerDefault" className="font-medium text-primary">
            Shared to your feed
          </ThemedText>
          <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
            Click to see
            <CaretRight size={14} weight="bold" />
          </span>
        </div>

        <div className="flex gap-3 p-4 pt-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {preview.authorAvatar ? (
                <img
                  src={preview.authorAvatar}
                  alt=""
                  className="h-6 w-6 shrink-0 rounded-full bg-muted object-cover"
                />
              ) : null}
              <ThemedText type="defaultSemiBold" className="truncate">
                {preview.authorName}
              </ThemedText>
            </div>
            {preview.taskLabel ? (
              <ThemedText type="caption" className="mt-1 block truncate text-muted-foreground">
                {preview.taskLabel}
              </ThemedText>
            ) : null}
            {preview.caption ? (
              <ThemedText type="default" className="mt-1 line-clamp-2 leading-5">
                {preview.caption}
              </ThemedText>
            ) : null}
          </div>
          {preview.image ? (
            <img
              src={preview.image}
              alt=""
              className="h-16 w-16 shrink-0 rounded-lg bg-muted object-cover"
            />
          ) : null}
        </div>

        <div className="task-toast-bar h-1 origin-left bg-primary" />
      </button>
    ),
    { duration: DURATION }
  );
}
