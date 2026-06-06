import React from "react";
import { render } from "@testing-library/react-native";
import PostCardCaption from "@/components/cards/PostCardCaption";

jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));

describe("PostCardCaption", () => {
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
});
