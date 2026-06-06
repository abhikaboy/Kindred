import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { TouchableOpacity } from "react-native";
import ReactPills from "@/components/inputs/ReactPills";

describe("ReactPills", () => {
    test("wires onLongPress to the pill", () => {
        const onLongPress = jest.fn();
        const { UNSAFE_getByType } = render(
            <ReactPills
                postId={0}
                reaction={{ emoji: "❤️", count: 3, ids: ["a"] }}
                onPress={() => {}}
                onLongPress={onLongPress}
            />,
        );
        // Assert the handler is wired onto the TouchableOpacity itself, not just
        // reachable by event bubbling to the ReactPills prop node.
        expect(UNSAFE_getByType(TouchableOpacity).props.onLongPress).toBe(onLongPress);
    });

    test("fires onLongPress when long-pressed", () => {
        const onLongPress = jest.fn();
        const { getByTestId } = render(
            <ReactPills
                postId={0}
                reaction={{ emoji: "❤️", count: 3, ids: ["a"] }}
                onPress={() => {}}
                onLongPress={onLongPress}
            />,
        );
        fireEvent(getByTestId("react-pill"), "longPress");
        expect(onLongPress).toHaveBeenCalledTimes(1);
    });

    test("fires onPress on a normal press", () => {
        const onPress = jest.fn();
        const { getByTestId } = render(
            <ReactPills
                postId={0}
                reaction={{ emoji: "❤️", count: 3, ids: ["a"] }}
                onPress={onPress}
                onLongPress={() => {}}
            />,
        );
        fireEvent(getByTestId("react-pill"), "press");
        expect(onPress).toHaveBeenCalledTimes(1);
    });
});
