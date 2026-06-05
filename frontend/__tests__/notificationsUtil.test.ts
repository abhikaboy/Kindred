import {
    SUPPORTED_TYPES,
    filterByActivityType,
    type ProcessedNotification,
} from "@/utils/notifications";

const mk = (type: ProcessedNotification["type"]): ProcessedNotification =>
    ({
        id: type,
        type,
        name: "",
        handle: "",
        userId: "",
        time: 0,
        icon: "",
        content: "",
        read: true,
        referenceId: "",
    }) as ProcessedNotification;

describe("notifications util", () => {
    test("friend_request is no longer supported, accepted still is", () => {
        expect(SUPPORTED_TYPES.has("friend_request")).toBe(false);
        expect(SUPPORTED_TYPES.has("friend_request_accepted")).toBe(true);
    });

    test("social filter returns only accepted-friend notifications", () => {
        const items = [mk("comment"), mk("friend_request_accepted"), mk("encouragement")];
        const social = filterByActivityType(items, "social");
        expect(social).toHaveLength(1);
        expect(social[0].type).toBe("friend_request_accepted");
    });

    test("comments filter returns only comments; all returns everything", () => {
        const items = [mk("comment"), mk("rings_closed"), mk("comment")];
        expect(filterByActivityType(items, "comments")).toHaveLength(2);
        expect(filterByActivityType(items, "all")).toHaveLength(3);
    });
});
