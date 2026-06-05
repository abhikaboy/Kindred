import React from "react";
import { render } from "@testing-library/react-native";
import UserInfoCommentNotification from "@/components/UserInfo/UserInfoCommentNotification";

jest.mock("@/components/CachedImage", () => "CachedImage");
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));

describe("UserInfoCommentNotification", () => {
    test("renders the comment as a speech bubble with header", () => {
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
        getByText("commented on your post");
        getByText("love this");
    });

    test("shows a post thumbnail only when the image differs from the avatar", () => {
        const withThumb = render(
            <UserInfoCommentNotification
                name="Sarah" userId="u1" comment="hi" icon="https://x/avatar.png"
                time={Date.now()} image="https://x/post.png" referenceId="post1"
            />,
        );
        expect(withThumb.queryByTestId("bubble-thumbnail")).toBeTruthy();

        const sameAsAvatar = render(
            <UserInfoCommentNotification
                name="Sarah" userId="u1" comment="hi" icon="https://x/avatar.png"
                time={Date.now()} image="https://x/avatar.png" referenceId="post1"
            />,
        );
        expect(sameAsAvatar.queryByTestId("bubble-thumbnail")).toBeNull();
    });
});
