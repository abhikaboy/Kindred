// Typed contract for the /for-you endpoint.
// Phase 1: backend isn't built yet; `fetchForYou` returns stub data from useForYou.

export type ForYouCardType =
    | "kudos_received"
    | "comment_reply"
    | "reciprocity_encourage"
    | "reciprocity_react"
    | "ring_progress"
    | "post_prompt"
    | "blueprint_suggestion";

export type ForYouIconKind = "kudos" | "users" | "ring" | "post" | "comment" | "blueprint";

export type ForYouSubject = {
    userId: string;
    displayName: string;
    avatarUrl?: string;
};

export type ForYouCtaAction =
    | { type: "navigate"; href: string }
    | { type: "send_kudos"; targetUserId: string; referenceId?: string }
    | { type: "send_encouragement"; targetUserId: string; taskId: string }
    | { type: "react"; postId: string; reaction: string };

export type ForYouCta = {
    label: string;
    kind: "primary" | "secondary";
    action: ForYouCtaAction;
};

export type ForYouCard = {
    id: string;
    type: ForYouCardType;
    displayMode: "full" | "compact";
    iconKind: ForYouIconKind;
    title: string;
    body?: string;
    subject?: ForYouSubject;
    ctas: ForYouCta[];
    deepLink: string;
    priority: number;
};

export type ForYouSection = {
    id: "catch_up" | "suggested";
    title: string;
    cards: ForYouCard[];
};

export type ForYouFeed = {
    sections: ForYouSection[];
    unreadCount: number;
};
