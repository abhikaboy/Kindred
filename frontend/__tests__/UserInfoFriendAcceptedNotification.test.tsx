import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { router } from "expo-router";
import UserInfoFriendAcceptedNotification from "@/components/UserInfo/UserInfoFriendAcceptedNotification";

jest.mock("@/components/CachedImage", () => "CachedImage");
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));

describe("UserInfoFriendAcceptedNotification", () => {
    test("renders the friends-now header and message", () => {
        const { getByText } = render(
            <UserInfoFriendAcceptedNotification
                name="Sarah" userId="u1"
                content="Sarah accepted your friend request" icon="https://x/a.png" time={Date.now()}
            />,
        );
        getByText("Friends now");
        getByText("accepted your friend request");
    });

    test("taps through to the sender's profile", () => {
        const { getByTestId } = render(
            <UserInfoFriendAcceptedNotification
                name="Sarah" userId="u1"
                content="Sarah accepted your friend request" icon="https://x/a.png" time={Date.now()}
            />,
        );
        fireEvent.press(getByTestId("speech-bubble-card"));
        expect(router.push).toHaveBeenCalledWith("/account/u1");
    });
});
