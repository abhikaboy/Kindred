import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import ReactPills from "@/components/inputs/ReactPills";

describe("ReactPills", () => {
    test("fires onLongPress when long-pressed", () => {
        const onLongPress = jest.fn();
        const { getByText } = render(
            <ReactPills
                postId={0}
                reaction={{ emoji: "❤️", count: 3, ids: ["a"] }}
                onPress={() => {}}
                onLongPress={onLongPress}
            />,
        );
        fireEvent(getByText("❤️"), "longPress");
        expect(onLongPress).toHaveBeenCalledTimes(1);
    });
});
