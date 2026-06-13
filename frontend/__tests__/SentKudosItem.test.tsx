import React from "react";
import { render } from "@testing-library/react-native";
import SentKudosItem from "@/components/cards/SentKudosItem";

jest.mock("@/components/CachedImage", () => "CachedImage");
jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }) }));

const base = {
    id: "k1",
    sender: { name: "Me", picture: "https://x/me.png", id: "u0" },
    receiverInfo: { name: "Sarah", picture: "https://x/a.png", id: "u1" },
    message: "you crushed it",
    categoryName: "Fitness",
    taskName: "Morning run",
    timestamp: new Date().toISOString(),
    read: true,
    type: "message",
};

describe("SentKudosItem", () => {
    test("shows the receiver, message and a pending indicator before any reaction", () => {
        const { getByText, getByTestId, queryByTestId } = render(
            <SentKudosItem kudos={base} formatTime={() => "5m ago"} />,
        );
        getByText("To");
        getByText("Sarah");
        getByText("you crushed it");
        getByText("5m ago");
        getByTestId("pending-indicator");
        expect(queryByTestId("sent-reaction")).toBeNull();
    });

    test("shows the reaction emoji inline once the receiver reacts", () => {
        const { getByTestId, queryByTestId } = render(
            <SentKudosItem kudos={{ ...base, reaction: "🔥" }} formatTime={() => "now"} />,
        );
        expect(getByTestId("sent-reaction")).toHaveTextContent("🔥");
        expect(queryByTestId("pending-indicator")).toBeNull();
    });

    test("falls back gracefully when the receiver info is missing", () => {
        const { getByText } = render(
            <SentKudosItem kudos={{ ...base, receiverInfo: undefined }} formatTime={() => "now"} />,
        );
        getByText("A friend");
    });
});
