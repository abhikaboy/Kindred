export type ProcessedNotification = {
    id: string;
    type:
        | "comment"
        | "encouragement"
        | "congratulation"
        | "kudos_reaction"
        | "friend_request"
        | "friend_request_accepted"
        | "rings_closed"
        | "post_tag"
        | "task_tagged"
        | "task_copied";
    name: string;
    handle: string;
    userId: string;
    time: number;
    icon: string;
    content: string;
    taskName?: string;
    /** Encouragement/congratulation: the kudos message after the "on TaskName:" prefix. */
    kudosMessage?: string;
    image?: string;
    read: boolean;
    referenceId: string;
    thumbnail?: string;
};

export type ActivityFilter = "all" | "encouragements" | "comments" | "social";

export const FILTER_CHIPS: { id: ActivityFilter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "encouragements", label: "Encouragements" },
    { id: "comments", label: "Comments" },
    { id: "social", label: "Social" },
];

// Friend requests are intentionally NOT supported on the Activity tab — incoming
// requests live on the Requests tab (getConnectionsByReceiverAPI). Only the
// informational "accepted" notification shows here, as a speech bubble.
export const SUPPORTED_TYPES = new Set([
    "comment",
    "encouragement",
    "congratulation",
    "kudos_reaction",
    "friend_request_accepted",
    "rings_closed",
    "post_tag",
    "task_tagged",
    "task_copied",
]);

export const filterByActivityType = (
    notifications: ProcessedNotification[],
    filter: ActivityFilter,
): ProcessedNotification[] => {
    switch (filter) {
        case "all":
            return notifications;
        case "encouragements":
            return notifications.filter(
                (n) => n.type === "encouragement" || n.type === "congratulation" || n.type === "kudos_reaction",
            );
        case "comments":
            return notifications.filter((n) => n.type === "comment");
        case "social":
            return notifications.filter((n) => n.type === "friend_request_accepted");
    }
};
