import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { router } from "expo-router";
import UserInfoFriendAcceptedNotification from "@/components/UserInfo/UserInfoFriendAcceptedNotification";

jest.mock("@/components/CachedImage", () => "CachedImage");
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
// SpeechBubbleCard pulls in KudosVideoPlayerModal → expo-video at import.
jest.mock("expo-video", () => ({ useVideoPlayer: () => ({}), VideoView: "VideoView" }));
jest.mock("react-native-safe-area-context", () => ({
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

describe("UserInfoFriendAcceptedNotification", () => {
    test("weaves the name into an 'accepted your friend request' title", () => {
        const { getByText } = render(
            <UserInfoFriendAcceptedNotification
                name="Sarah" userId="u1"
                content="Sarah accepted your friend request" icon="https://x/a.png" time={Date.now()}
            />,
        );
        getByText("Sarah");
        getByText(/accepted your friend request/);
    });

    test("taps through to the sender's profile", () => {
        const { getByText } = render(
            <UserInfoFriendAcceptedNotification
                name="Sarah" userId="u1"
                content="Sarah accepted your friend request" icon="https://x/a.png" time={Date.now()}
            />,
        );
        fireEvent.press(getByText("Sarah"));
        expect(router.push).toHaveBeenCalledWith("/account/u1");
    });
});
