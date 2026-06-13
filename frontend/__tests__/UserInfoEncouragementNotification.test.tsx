import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import UserInfoEncouragementNotification from "@/components/UserInfo/UserInfoEncouragementNotification";

jest.mock("@/components/CachedImage", () => "CachedImage");
jest.mock("expo-router", () => ({
    router: { push: jest.fn() },
    useRouter: () => ({ push: jest.fn() }),
}));
// Reanimated v4 pulls in react-native-worklets at import time, which crashes under jest
jest.mock("react-native-worklets", () => require("react-native-worklets/src/mock"));
jest.mock("react-native-reanimated", () => require("react-native-reanimated/mock"));

// Controls what useKudosOptional returns per test (undefined = outside provider)
let mockKudosCtx: any;
jest.mock("@/contexts/kudosContext", () => ({
    useKudosOptional: () => mockKudosCtx,
}));

beforeEach(() => {
    mockKudosCtx = undefined;
});

const base = {
    name: "Sarah",
    userId: "u1",
    taskName: "Morning run",
    icon: "https://x/a.png",
    time: Date.now(),
    referenceId: "task1",
    type: "encouragement" as const,
};

describe("UserInfoEncouragementNotification", () => {
    test("renders a text message as text", () => {
        const { getByText, queryByTestId } = render(
            <UserInfoEncouragementNotification {...base} message="you crushed it" />,
        );
        getByText("you crushed it");
        expect(queryByTestId("bubble-image")).toBeNull();
    });

    test("renders an image-URL message as an image, not text", () => {
        const url = "https://media.giphy.com/media/abc/giphy.gif";
        const { queryByText, getByTestId } = render(
            <UserInfoEncouragementNotification {...base} message={url} />,
        );
        getByTestId("bubble-image");
        expect(queryByText(url)).toBeNull();
    });

    test("no reaction button when the kudos can't be matched to context", () => {
        const { queryByTestId } = render(
            <UserInfoEncouragementNotification {...base} message="you crushed it" />,
        );
        expect(queryByTestId("kudos-reaction-button")).toBeNull();
    });

    test("reacts in place when the kudos is matched in context", () => {
        const reactToEncouragement = jest.fn();
        mockKudosCtx = {
            encouragements: [
                {
                    id: "enc1",
                    sender: { name: "Sarah", picture: "https://x/a.png", id: "u1" },
                    message: "you crushed it",
                    scope: "task",
                    timestamp: new Date(base.time).toISOString(),
                    read: true,
                },
            ],
            congratulations: [],
            reactToEncouragement,
            reactToCongratulation: jest.fn(),
        };

        const { getByTestId } = render(
            <UserInfoEncouragementNotification {...base} message="you crushed it" />,
        );
        fireEvent.press(getByTestId("kudos-reaction-button"));
        expect(reactToEncouragement).toHaveBeenCalledWith("enc1", "❤️");
    });

    test("shows the current reaction from the matched kudos", () => {
        mockKudosCtx = {
            encouragements: [
                {
                    id: "enc1",
                    sender: { name: "Sarah", picture: "https://x/a.png", id: "u1" },
                    message: "you crushed it",
                    scope: "task",
                    timestamp: new Date(base.time).toISOString(),
                    read: true,
                    reaction: "🔥",
                },
            ],
            congratulations: [],
            reactToEncouragement: jest.fn(),
            reactToCongratulation: jest.fn(),
        };

        const { getByText } = render(
            <UserInfoEncouragementNotification {...base} message="you crushed it" />,
        );
        getByText("🔥");
    });
});
