import React from "react";
import { render, act } from "@testing-library/react-native";
import { BlurView } from "expo-blur";
import CoachSpotlight from "@/components/onboarding/CoachSpotlight";

// Reanimated v4 pulls in react-native-worklets at import time, which crashes under jest
jest.mock("react-native-worklets", () => require("react-native-worklets/src/mock"));
jest.mock("react-native-reanimated", () => require("react-native-reanimated/mock"));

const frame = { x: 20, y: 100, width: 120, height: 48 };
const layout = { nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 800 } } };

describe("CoachSpotlight", () => {
    test("renders nothing without a frame", () => {
        const { queryByTestId, UNSAFE_queryAllByType } = render(<CoachSpotlight frame={null} active />);
        expect(queryByTestId("coach-spotlight")).toBeNull();
        expect(UNSAFE_queryAllByType(BlurView)).toHaveLength(0);
    });

    test("renders nothing when inactive", () => {
        const { queryByTestId } = render(<CoachSpotlight frame={frame} active={false} />);
        expect(queryByTestId("coach-spotlight")).toBeNull();
    });

    test("renders a non-interactive root when active with a frame", () => {
        const { getByTestId } = render(<CoachSpotlight frame={frame} active testID="spot" />);
        expect(getByTestId("spot").props.pointerEvents).toBe("none");
    });

    test("renders four non-interactive blur bands around the target once laid out", () => {
        const { getByTestId, UNSAFE_getAllByType, queryByTestId } = render(<CoachSpotlight frame={frame} active />);
        act(() => getByTestId("coach-spotlight").props.onLayout(layout));
        const blurs = UNSAFE_getAllByType(BlurView);
        expect(blurs).toHaveLength(4);
        blurs.forEach((b) => expect(b.props.pointerEvents).toBe("none"));
        expect(queryByTestId("coach-spotlight-ring")).toBeNull();
    });
});
