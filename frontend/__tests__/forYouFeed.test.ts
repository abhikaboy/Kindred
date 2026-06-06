import { dismissCardFromFeed } from "@/api/forYou";
import type { ForYouCard, ForYouFeed } from "@/api/forYou";

const card = (id: string): ForYouCard => ({
    id,
    type: "kudos_received",
    displayMode: "full",
    iconKind: "kudos",
    title: id,
    ctas: [],
    deepLink: "/x",
    priority: 1,
});

const feed = (): ForYouFeed => ({
    unreadCount: 3,
    sections: [
        { id: "catch_up", title: "Catch up", cards: [card("a"), card("b")] },
        { id: "suggested", title: "Suggested", cards: [card("c")] },
    ],
});

describe("dismissCardFromFeed", () => {
    test("removes the matching card and leaves the rest intact", () => {
        const next = dismissCardFromFeed(feed(), "b");
        expect(next.sections[0].cards.map((c) => c.id)).toEqual(["a"]);
        expect(next.sections[1].cards.map((c) => c.id)).toEqual(["c"]);
    });

    test("preserves unreadCount and section structure", () => {
        const next = dismissCardFromFeed(feed(), "a");
        expect(next.unreadCount).toBe(3);
        expect(next.sections).toHaveLength(2);
    });

    test("returns an unchanged feed when the id is not present", () => {
        const next = dismissCardFromFeed(feed(), "missing");
        expect(next.sections[0].cards).toHaveLength(2);
        expect(next.sections[1].cards).toHaveLength(1);
    });
});
