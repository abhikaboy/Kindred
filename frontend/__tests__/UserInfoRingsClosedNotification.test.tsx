import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import UserInfoRingsClosedNotification from "@/components/UserInfo/UserInfoRingsClosedNotification";

jest.mock("@/components/CachedImage", () => "CachedImage");
jest.mock("expo-video", () => ({
    useVideoPlayer: () => ({}),
    VideoView: "VideoView",
}));
jest.mock("react-native-safe-area-context", () => ({
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("@/components/modals/CongratulateModal", () => {
    const { Text, Pressable } = require("react-native");
    return ({ visible, onSent }: { visible: boolean; onSent?: () => void }) =>
        visible ? (
            <Pressable onPress={() => onSent?.()}>
                <Text>congrats-modal-open</Text>
            </Pressable>
        ) : null;
});

describe("UserInfoRingsClosedNotification", () => {
    test("renders the sentence and the Send congrats action", () => {
        const { getByText } = render(
            <UserInfoRingsClosedNotification
                notificationId="n1" name="Sarah" userId="u1"
                content="Sarah closed all their rings" icon="https://x/a.png" time={Date.now()}
            />,
        );
        getByText("Sarah");
        getByText(/closed all their rings/);
        getByText("Send congrats");
    });

    test("opens the congratulate modal when Send congrats is pressed", () => {
        const { getByText, queryByText } = render(
            <UserInfoRingsClosedNotification
                notificationId="n1" name="Sarah" userId="u1"
                content="Sarah closed all their rings" icon="https://x/a.png" time={Date.now()}
            />,
        );
        expect(queryByText("congrats-modal-open")).toBeNull();
        fireEvent.press(getByText("Send congrats"));
        getByText("congrats-modal-open");
    });

    test("converts the CTA to a sent state after the congrats is sent", () => {
        const { getByText, queryByText } = render(
            <UserInfoRingsClosedNotification
                notificationId="sent-1" name="Sarah" userId="u1"
                content="Sarah closed all their rings" icon="https://x/a.png" time={Date.now()}
            />,
        );
        fireEvent.press(getByText("Send congrats"));
        fireEvent.press(getByText("congrats-modal-open"));
        getByText("Congrats sent");
        expect(queryByText("Send congrats")).toBeNull();
    });

    test("sent state survives unmount/remount within the session", () => {
        const props = {
            notificationId: "sent-2", name: "Sarah", userId: "u1",
            content: "Sarah closed all their rings", icon: "https://x/a.png", time: Date.now(),
        };
        const first = render(<UserInfoRingsClosedNotification {...props} />);
        fireEvent.press(first.getByText("Send congrats"));
        fireEvent.press(first.getByText("congrats-modal-open"));
        first.unmount();

        const second = render(<UserInfoRingsClosedNotification {...props} />);
        second.getByText("Congrats sent");
        expect(second.queryByText("Send congrats")).toBeNull();
    });
});
