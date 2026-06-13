import React from "react";
import { render } from "@testing-library/react-native";
import KudosItem from "@/components/cards/KudosItem";

jest.mock("@/components/CachedImage", () => "CachedImage");
jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("expo-video", () => ({
    useVideoPlayer: () => ({}),
    VideoView: "VideoView",
}));
// KudosVideoPlayerModal positions its close button with safe-area insets.
jest.mock("react-native-safe-area-context", () => ({
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
// Reanimated v4 pulls in react-native-worklets at import time, which crashes under jest
jest.mock("react-native-worklets", () => require("react-native-worklets/src/mock"));
jest.mock("react-native-reanimated", () => require("react-native-reanimated/mock"));

const base = {
    id: "k1",
    sender: { name: "Sarah", picture: "https://x/a.png", id: "u1" },
    message: "you crushed it",
    timestamp: new Date().toISOString(),
    read: true,
    type: "message",
};

describe("KudosItem", () => {
    test("task-scope kudos shows category, task and message", () => {
        const { getByText } = render(
            <KudosItem
                kudos={{ ...base, scope: "task", categoryName: "Fitness", taskName: "Morning run" }}
                formatTime={() => "5m ago"}
            />,
        );
        getByText("Fitness");
        getByText("Morning run");
        getByText("you crushed it");
        getByText("5m ago");
    });

    test("profile-scope kudos shows the profile header", () => {
        const { getByText } = render(
            <KudosItem kudos={{ ...base, scope: "profile" }} formatTime={() => "now"} />,
        );
        getByText("Profile Encouragement 🎉");
    });

    test("video kudos renders the thumbnail, not the raw URL", () => {
        const { getByTestId, queryByText } = render(
            <KudosItem
                kudos={{
                    ...base,
                    scope: "task",
                    categoryName: "Fitness",
                    taskName: "Morning run",
                    type: "video",
                    message: "https://x/cheer.mp4",
                    thumbnailUrl: "https://x/cheer-thumb.jpg",
                    durationMs: 12000,
                }}
                formatTime={() => "now"}
            />,
        );
        getByTestId("bubble-video");
        expect(queryByText("https://x/cheer.mp4")).toBeNull();
    });
});
