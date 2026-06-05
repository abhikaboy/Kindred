import React from "react";
import { Animated } from "react-native";
import { render, fireEvent } from "@testing-library/react-native";
import { TaskSelectionView } from "@/components/ui/fab/TaskSelectionView";

const setup = () => {
    const handlers = {
        onTaskPress: jest.fn(),
        onPostPress: jest.fn(),
        onWorkspacePress: jest.fn(),
        onVoiceInputPress: jest.fn(),
    };
    const utils = render(
        <TaskSelectionView
            opacity={new Animated.Value(1)}
            onLayout={jest.fn()}
            {...handlers}
        />
    );
    return { ...utils, ...handlers };
};

describe("TaskSelectionView", () => {
    test("renders all four action rows on any tab", () => {
        const { getByText } = setup();
        getByText("Task");
        getByText("Post");
        getByText("Workspace");
        getByText("Voice Input");
    });

    test("each row triggers its own handler", () => {
        const view = setup();
        fireEvent.press(view.getByText("Task"));
        fireEvent.press(view.getByText("Post"));
        fireEvent.press(view.getByText("Workspace"));
        fireEvent.press(view.getByText("Voice Input"));
        expect(view.onTaskPress).toHaveBeenCalledTimes(1);
        expect(view.onPostPress).toHaveBeenCalledTimes(1);
        expect(view.onWorkspacePress).toHaveBeenCalledTimes(1);
        expect(view.onVoiceInputPress).toHaveBeenCalledTimes(1);
    });
});
