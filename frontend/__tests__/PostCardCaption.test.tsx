import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { router } from "expo-router";
import PostCardCaption from "@/components/cards/PostCardCaption";

jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));

describe("PostCardCaption", () => {
    beforeEach(() => {
        (router.push as jest.Mock).mockClear();
    });

    it("links @handle runs that match taggedUsers", () => {
        const { getByText } = render(
            <PostCardCaption
                caption="hi @sarah and @notreal"
                taggedUsers={[{ id: "u1", handle: "@sarah" }]}
            />
        );
        expect(getByText("@sarah")).toBeTruthy();
        expect(getByText("@notreal")).toBeTruthy(); // rendered, but as plain text
    });

    it("tapping a matched mention navigates to the user's profile", () => {
        const { getByText } = render(
            <PostCardCaption caption="hi @sarah" taggedUsers={[{ id: "u1", handle: "sarah" }]} />
        );
        fireEvent.press(getByText("@sarah"));
        expect(router.push).toHaveBeenCalledWith("/account/u1");
    });

    it("matches even when the stored handle carries a leading @", () => {
        const { getByText } = render(
            <PostCardCaption caption="hi @sarah" taggedUsers={[{ id: "u1", handle: "@sarah" }]} />
        );
        fireEvent.press(getByText("@sarah"));
        expect(router.push).toHaveBeenCalledWith("/account/u1");
    });
});
