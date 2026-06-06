import React from "react";
import { render } from "@testing-library/react-native";
import UserInfoEncouragementNotification from "@/components/UserInfo/UserInfoEncouragementNotification";

jest.mock("@/components/CachedImage", () => "CachedImage");
jest.mock("expo-router", () => ({
    router: { push: jest.fn() },
    useRouter: () => ({ push: jest.fn() }),
}));

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
});
