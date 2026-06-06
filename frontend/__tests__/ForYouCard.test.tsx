import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import ForYouCard from "@/components/forYou/ForYouCard";
import type { ForYouCard as ForYouCardModel } from "@/api/forYou";

jest.mock("@/components/CachedImage", () => "CachedImage");
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));

const kudosCard = (overrides: Partial<ForYouCardModel> = {}): ForYouCardModel => ({
    id: "kudos-1",
    type: "kudos_received",
    displayMode: "full",
    iconKind: "kudos",
    title: "Sarah sent you a kudos!",
    subject: { userId: "u1", displayName: "Sarah", avatarUrl: "https://x/sarah.png" },
    ctas: [],
    deepLink: "/x",
    priority: 1,
    ...overrides,
});

describe("ForYouCard", () => {
    test("features the sender's avatar when subject.avatarUrl is present", () => {
        const { getByTestId } = render(<ForYouCard card={kudosCard()} />);
        getByTestId("foryou-card-avatar");
    });

    test("falls back to the kind icon when there's no avatar", () => {
        const { queryByTestId } = render(
            <ForYouCard card={kudosCard({ subject: undefined })} />,
        );
        expect(queryByTestId("foryou-card-avatar")).toBeNull();
    });

    test("features the avatar in compact mode too", () => {
        const { getByTestId } = render(<ForYouCard card={kudosCard({ displayMode: "compact" })} />);
        getByTestId("foryou-card-avatar");
    });

    test("a dismiss CTA calls onDismiss with the card id, not onAction", () => {
        const onDismiss = jest.fn();
        const onAction = jest.fn();
        const card = kudosCard({
            ctas: [{ label: "Dismiss", kind: "secondary", action: { type: "dismiss" } }],
        });
        const { getByText } = render(
            <ForYouCard card={card} onAction={onAction} onDismiss={onDismiss} />,
        );
        fireEvent.press(getByText("Dismiss"));
        expect(onDismiss).toHaveBeenCalledWith("kudos-1");
        expect(onAction).not.toHaveBeenCalled();
    });
});
