import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import UserInfoRingsClosedNotification from "@/components/UserInfo/UserInfoRingsClosedNotification";

jest.mock("@/components/CachedImage", () => "CachedImage");
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("@/components/modals/CongratulateModal", () => {
    const { Text } = require("react-native");
    return ({ visible }: { visible: boolean }) => (visible ? <Text>congrats-modal-open</Text> : null);
});

describe("UserInfoRingsClosedNotification", () => {
    test("renders rings header, message and the Send congrats action", () => {
        const { getByText } = render(
            <UserInfoRingsClosedNotification
                notificationId="n1" name="Sarah" userId="u1"
                content="Sarah closed all their rings" icon="https://x/a.png" time={Date.now()}
            />,
        );
        getByText("🎉 Closed all rings");
        getByText("closed all their rings");
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
});
