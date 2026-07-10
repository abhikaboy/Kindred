import React from "react";
import { render } from "@testing-library/react-native";
import UserInfoTaskCopiedNotification from "@/components/UserInfo/UserInfoTaskCopiedNotification";

jest.mock("@/components/CachedImage", () => "CachedImage");
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
// SpeechBubbleCard pulls in KudosVideoPlayerModal → expo-video at import.
jest.mock("expo-video", () => ({ useVideoPlayer: () => ({}), VideoView: "VideoView" }));
jest.mock("react-native-safe-area-context", () => ({
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

describe("UserInfoTaskCopiedNotification", () => {
    test("weaves the name into a 'added from your blueprint' sentence and shows the task name", () => {
        const { getByText } = render(
            <UserInfoTaskCopiedNotification
                name="Sarah"
                userId="u1"
                content={'copied your task "Morning Run" 💪'}
                icon="https://x/a.png"
                time={Date.now()}
                referenceId="task1"
            />,
        );
        getByText("Sarah");
        getByText(/from your blueprint/);
        getByText(/Morning Run/);
    });
});
