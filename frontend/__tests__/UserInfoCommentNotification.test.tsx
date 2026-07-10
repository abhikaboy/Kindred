import React from "react";
import { render } from "@testing-library/react-native";
import UserInfoCommentNotification from "@/components/UserInfo/UserInfoCommentNotification";

jest.mock("@/components/CachedImage", () => "CachedImage");
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
// SpeechBubbleCard pulls in KudosVideoPlayerModal → expo-video at import.
jest.mock("expo-video", () => ({ useVideoPlayer: () => ({}), VideoView: "VideoView" }));
jest.mock("react-native-safe-area-context", () => ({
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

describe("UserInfoCommentNotification", () => {
    test("renders the comment text with the sender name and action", () => {
        const { getByText } = render(
            <UserInfoCommentNotification
                name="Sarah"
                userId="u1"
                comment="love this"
                icon="https://x/avatar.png"
                time={Date.now()}
                referenceId="post1"
            />,
        );
        getByText("Sarah");
        getByText(/commented on your post/);
        getByText(/love this/);
    });

    test("renders without crashing when image matches avatar", () => {
        const { getByText } = render(
            <UserInfoCommentNotification
                name="Sarah" userId="u1" comment="hi" icon="https://x/avatar.png"
                time={Date.now()} image="https://x/avatar.png" referenceId="post1"
            />,
        );
        getByText("Sarah");
    });
});
