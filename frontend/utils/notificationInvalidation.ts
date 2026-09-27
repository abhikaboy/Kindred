export type NotificationRefreshPlan = {
    /** Refresh everything (unknown notification type). */
    all: boolean;
    /** First segment of the react-query keys to invalidate. */
    queryRoots: string[];
    kudos: boolean;
    workspaces: boolean;
};

const ALL: NotificationRefreshPlan = { all: true, queryRoots: [], kudos: true, workspaces: true };

const plan = (queryRoots: string[], opts: { kudos?: boolean; workspaces?: boolean } = {}): NotificationRefreshPlan => ({
    all: false,
    queryRoots,
    kudos: !!opts.kudos,
    workspaces: !!opts.workspaces,
});

const KUDOS = plan(["notifications"], { kudos: true });
const FRIENDS = plan([
    "notifications",
    "connections",
    "friends",
    "home-friends",
    "suggestedUsers",
    "friend-profile",
    "friends-of-user",
    "profile",
]);
const FEED = plan([
    "notifications",
    "posts",
    "friendsPosts",
    "forYou",
    "userPosts",
    "friend-latest-post",
    "memories-posts",
]);
const TASKS = plan(["taskTags", "completedTasks", "rings"], { workspaces: true });
const NOTHING = plan([]);

/** Decide what a push of the given type could have changed server-side. Unknown types refresh everything. */
export function getNotificationRefreshPlan(type: string | undefined): NotificationRefreshPlan {
    switch (type) {
        case "encouragement":
        case "congratulation":
        case "kudos_reaction":
        case "kudos_suggestion":
            return KUDOS;
        case "task_completion":
            return plan(["notifications"]);
        case "friend_request":
        case "friend_request_accepted":
        case "contact_joined":
            return FRIENDS;
        case "new_post":
        case "comment":
        case "post_tag":
            return FEED;
        case "rings_closed":
            return plan(["rings", "friend-profile", "profile"]);
        case "task_tagged":
        case "task_copied":
        case "task_completed_watcher":
        case "TASK_MISSED":
        case "TASK_REGENERATED":
            return TASKS;
        // Reminders, check-ins and live-activity pushes don't reflect a server change
        case "ABSOLUTE":
        case "RELATIVE":
        case "FOLLOW_UP":
        case "checkin":
        case "live_activity":
            return NOTHING;
        default:
            return ALL;
    }
}
