import { showToastable } from "react-native-toastable";

/**
 * Data-only pushes the server sends when background work finishes. Each type
 * gets a handler here; the cache refresh itself comes from notificationInvalidation.
 */
type SilentPushData = Record<string, string | undefined> & { type?: string };
type SilentPushHandler = (data: SilentPushData) => void;

const handlers: Record<string, SilentPushHandler> = {
    task_filed: (data) => {
        if (!data.categoryName) return;
        showToastable({
            message: data.taskName ? `Filed "${data.taskName}" in ${data.categoryName}` : `Filed in ${data.categoryName}`,
            status: "success",
            duration: 2500,
        });
    },
};

export const isSilentPush = (content: { title?: string | null; body?: string | null }) =>
    !content.title && !content.body;

/** Runs the handler for a silent push's type; unknown types are ignored. */
export function handleSilentPush(data: SilentPushData | undefined) {
    const handler = data?.type ? handlers[data.type] : undefined;
    handler?.(data!);
}
