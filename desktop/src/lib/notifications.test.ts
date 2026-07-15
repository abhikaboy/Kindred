import { describe, it, expect } from "vitest";
import type { components } from "@/lib/api/types.gen";
import {
    processNotification,
    filterByActivityType,
    groupByTimePeriod,
    type ProcessedNotification,
} from "@/lib/notifications";

type NotificationDocument = components["schemas"]["NotificationDocument"];

function makeDoc(overrides: Partial<NotificationDocument> = {}): NotificationDocument {
    return {
        id: "n1",
        content: "",
        notificationType: "COMMENT",
        read: false,
        receiver: "me",
        reference_id: "ref1",
        time: new Date().toISOString(),
        user: {
            display_name: "John",
            handle: "@john",
            id: "u1",
            profile_picture: "pic.png",
        },
        ...overrides,
    };
}

function makeProcessed(overrides: Partial<ProcessedNotification> = {}): ProcessedNotification {
    return {
        id: "p1",
        type: "comment",
        name: "John",
        handle: "@john",
        userId: "u1",
        time: Date.now(),
        icon: "pic.png",
        content: "",
        read: false,
        referenceId: "ref1",
        ...overrides,
    };
}

describe("processNotification", () => {
    it("parses task-scope encouragement content", () => {
        const result = processNotification(
            makeDoc({
                notificationType: "ENCOURAGEMENT",
                content: 'John on "Design review": "keep going"',
            }),
        );
        expect(result).not.toBeNull();
        expect(result?.type).toBe("encouragement");
        expect(result?.taskName).toBe("Design review");
        expect(result?.kudosMessage).toBe("keep going");
    });

    it("parses profile-scope encouragement content", () => {
        const result = processNotification(
            makeDoc({
                notificationType: "ENCOURAGEMENT",
                content: 'John says: "you got this"',
            }),
        );
        expect(result).not.toBeNull();
        expect(result?.taskName).toBeUndefined();
        expect(result?.kudosMessage).toBe("you got this");
    });

    it("returns null for unsupported types", () => {
        expect(processNotification(makeDoc({ notificationType: "friend_request" }))).toBeNull();
    });

    it("drops legacy self rings_closed but keeps non-self", () => {
        const selfDoc = makeDoc({
            notificationType: "rings_closed",
            user: { display_name: "Me", handle: "@me", id: "me1", profile_picture: "p.png" },
        });
        expect(processNotification(selfDoc, "me1")).toBeNull();

        const otherDoc = makeDoc({
            notificationType: "rings_closed",
            user: { display_name: "Friend", handle: "@f", id: "u2", profile_picture: "p.png" },
        });
        expect(processNotification(otherDoc, "me1")).not.toBeNull();
    });
});

describe("filterByActivityType", () => {
    const list: ProcessedNotification[] = [
        makeProcessed({ id: "a", type: "encouragement" }),
        makeProcessed({ id: "b", type: "congratulation" }),
        makeProcessed({ id: "c", type: "kudos_reaction" }),
        makeProcessed({ id: "d", type: "comment" }),
        makeProcessed({ id: "e", type: "friend_request_accepted" }),
        makeProcessed({ id: "f", type: "rings_closed" }),
    ];

    it("all returns everything", () => {
        expect(filterByActivityType(list, "all")).toHaveLength(6);
    });

    it("encouragements returns encouragement/congratulation/kudos_reaction", () => {
        const r = filterByActivityType(list, "encouragements");
        expect(r.map((n) => n.id).sort()).toEqual(["a", "b", "c"]);
    });

    it("comments returns only comment", () => {
        const r = filterByActivityType(list, "comments");
        expect(r.map((n) => n.id)).toEqual(["d"]);
    });

    it("social returns only friend_request_accepted", () => {
        const r = filterByActivityType(list, "social");
        expect(r.map((n) => n.id)).toEqual(["e"]);
    });
});

describe("groupByTimePeriod", () => {
    it("buckets timestamps and omits empty groups", () => {
        const now = Date.now();
        const DAY = 86400000;
        const list: ProcessedNotification[] = [
            makeProcessed({ id: "today", time: now }),
            makeProcessed({ id: "week", time: now - 2 * DAY }),
            makeProcessed({ id: "month", time: now - 10 * DAY }),
            makeProcessed({ id: "older", time: now - 40 * DAY }),
        ];

        const groups = groupByTimePeriod(list);
        expect(groups.map((g) => g.title)).toEqual(["Today", "This Week", "This Month", "Older"]);
        expect(groups[0].data[0].id).toBe("today");
        expect(groups[1].data[0].id).toBe("week");
        expect(groups[2].data[0].id).toBe("month");
        expect(groups[3].data[0].id).toBe("older");
    });

    it("omits groups with no items", () => {
        const now = Date.now();
        const groups = groupByTimePeriod([makeProcessed({ id: "only", time: now })]);
        expect(groups).toHaveLength(1);
        expect(groups[0].title).toBe("Today");
    });
});
