import type { components } from "@/lib/api/types.gen";

type NotificationDocument = components["schemas"]["NotificationDocument"];

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
    kudosMessage?: string;
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

// friend_request is intentionally excluded — incoming requests live elsewhere.
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

export function processNotification(
    raw: NotificationDocument,
    currentUserId?: string,
): ProcessedNotification | null {
    try {
        const type = raw.notificationType.toLowerCase();
        if (!SUPPORTED_TYPES.has(type)) {
            return null;
        }
        // Strip legacy self rings-closed docs (user notified about their own rings).
        if (type === "rings_closed" && currentUserId && raw.user.id === currentUserId) {
            return null;
        }

        // Encouragement/congratulation content has two shapes:
        //   task scope    → `{name} on "{taskName}": "{message}"`
        //   profile scope → `{name} says: "{message}"`
        let taskName = "";
        let kudosMessage: string | undefined;
        if (raw.notificationType === "ENCOURAGEMENT" || raw.notificationType === "CONGRATULATION") {
            const taskMatch = raw.content.match(/ on "?(.+?)"?:\s*"?(.*?)"?$/);
            const profileMatch = raw.content.match(/ says:\s*"?(.*?)"?$/);
            if (taskMatch) {
                taskName = taskMatch[1];
                kudosMessage = taskMatch[2]?.trim() || undefined;
            } else if (profileMatch) {
                kudosMessage = profileMatch[1]?.trim() || undefined;
            }
        }

        return {
            id: raw.id,
            type: type as ProcessedNotification["type"],
            name: raw.user.display_name,
            handle: raw.user.handle ?? "",
            userId: raw.user.id,
            time: new Date(raw.time).getTime(),
            icon: raw.user.profile_picture,
            content: raw.content,
            taskName: taskName || undefined,
            kudosMessage,
            read: raw.read,
            referenceId: raw.reference_id,
            thumbnail: raw.thumbnail,
        };
    } catch {
        return null;
    }
}

export function filterByActivityType(
    list: ProcessedNotification[],
    filter: ActivityFilter,
): ProcessedNotification[] {
    switch (filter) {
        case "all":
            return list;
        case "encouragements":
            return list.filter(
                (n) =>
                    n.type === "encouragement" ||
                    n.type === "congratulation" ||
                    n.type === "kudos_reaction",
            );
        case "comments":
            return list.filter((n) => n.type === "comment");
        case "social":
            return list.filter((n) => n.type === "friend_request_accepted");
    }
}

export function groupByTimePeriod(
    list: ProcessedNotification[],
): { title: string; data: ProcessedNotification[] }[] {
    const ONE_DAY = 86400000;
    const ONE_WEEK = ONE_DAY * 7;
    const ONE_MONTH = ONE_DAY * 30;

    const now = Date.now();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMidnight = today.getTime();

    const groups = [
        { title: "Today", data: list.filter((n) => n.time >= todayMidnight) },
        {
            title: "This Week",
            data: list.filter((n) => n.time >= now - ONE_WEEK && n.time < todayMidnight),
        },
        {
            title: "This Month",
            data: list.filter((n) => n.time >= now - ONE_MONTH && n.time < now - ONE_WEEK),
        },
        { title: "Older", data: list.filter((n) => n.time < now - ONE_MONTH) },
    ];

    return groups.filter((g) => g.data.length > 0);
}

const MONTHS = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
];

export function formatNotificationTime(ms: number): string {
    const currentTime = Date.now();
    const notificationDate = new Date(ms);
    const timeDifference = currentTime - ms;

    const diffMinutes = Math.floor(timeDifference / (1000 * 60));
    const diffHours = Math.floor(timeDifference / (1000 * 60 * 60));
    const diffDays = Math.floor(timeDifference / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
        if (diffMinutes < 60) {
            return diffMinutes === 0 ? "Just now" : `${diffMinutes}m ago`;
        }
        return `${diffHours}h ago`;
    }
    if (diffDays < 7) {
        return `${diffDays}d ago`;
    }

    const today = new Date();
    const dayMonth = `${notificationDate.getDate()} ${MONTHS[notificationDate.getMonth()].substring(0, 3)}`;
    if (
        notificationDate.getMonth() === today.getMonth() &&
        notificationDate.getFullYear() === today.getFullYear()
    ) {
        return dayMonth;
    }
    return `${dayMonth} ${notificationDate.getFullYear()}`;
}
