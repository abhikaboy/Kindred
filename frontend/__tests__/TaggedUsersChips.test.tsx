import React from "react";
import { render } from "@testing-library/react-native";
import TaggedUsersChips from "@/components/inputs/TaggedUsersChips";

// expose the resolved image uri so we can assert the avatar was given a source
jest.mock("@/components/CachedImage", () => {
    const { View } = require("react-native");
    return {
        __esModule: true,
        default: (props: any) => <View testID="avatar" accessibilityLabel={props.source?.uri} />,
    };
});

describe("TaggedUsersChips", () => {
    it("shows the tagged user's avatar from their profile picture", () => {
        const { getByText, getByTestId } = render(
            <TaggedUsersChips
                users={[{ id: "u1", handle: "@sarah", profile_picture: "https://cdn/sarah.jpg" }]}
                onRemove={() => {}}
            />
        );
        expect(getByText("@sarah")).toBeTruthy();
        expect(getByTestId("avatar").props.accessibilityLabel).toBe("https://cdn/sarah.jpg");
    });

    it("falls back to a placeholder when there is no profile picture", () => {
        const { getByText, queryByTestId } = render(
            <TaggedUsersChips users={[{ id: "u2", handle: "@nopic" }]} onRemove={() => {}} />
        );
        expect(getByText("@nopic")).toBeTruthy();
        expect(queryByTestId("avatar")).toBeNull();
    });
});
