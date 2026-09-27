import type { components } from "@/lib/api/types.gen";
import type { Activity, ActivitySection, SupportOption } from "@shared/friendActivity";

export {
    activityStatus,
    buildOptions,
    getActivity,
    groupByActivity,
    isToday,
    shortElapsed,
    type SupportKind,
} from "@shared/friendActivity";

// Desktop-typed aliases over the shared, structurally-typed friend activity logic.
export type FriendProfile = components["schemas"]["ProfileDocument"];
export type FriendTask = components["schemas"]["TaskDocument"];
export type FriendActivity = Activity<FriendTask>;
export type FriendSupportOption = SupportOption<FriendTask>;
export type FriendSection<R> = ActivitySection<R>;
