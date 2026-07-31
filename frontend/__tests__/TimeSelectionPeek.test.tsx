import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { TimeSelectionPeek } from "@/components/daily/TimeSelectionPeek";

// Reanimated v4 pulls in react-native-worklets at import time, which crashes under jest
jest.mock("react-native-worklets", () => require("react-native-worklets/src/mock"));
jest.mock("react-native-reanimated", () => require("react-native-reanimated/mock"));

const taskA = { id: "t1", content: "Write spec", categoryID: "c1", categoryName: "Work", workspaceName: "Kindred" };
const taskB = { id: "t2", content: "Go for a run", categoryID: "c2", categoryName: "Fitness" };

const setup = (overrides: Record<string, any> = {}) => {
    const handlers = { onAssign: jest.fn(), onCreateNew: jest.fn(), onCancel: jest.fn() };
    const utils = render(
        <TimeSelectionPeek
            range={{ startMinutes: 570, endMinutes: 630 }}
            selectedDate={new Date(2026, 6, 30)}
            tasks={[taskA, taskB]}
            assigningTaskId={null}
            {...handlers}
            {...overrides}
        />
    );
    return { ...utils, ...handlers };
};

describe("TimeSelectionPeek", () => {
    test("renders the live range, duration and task cards", () => {
        const { getByText } = setup();
        getByText("9:30 AM – 10:30 AM");
        getByText("· 1h");
        getByText("Write spec");
        getByText("Work · Kindred");
        getByText("Go for a run");
    });

    test("the header tracks a changed range", () => {
        const { getByText, rerender } = setup();
        rerender(
            <TimeSelectionPeek
                range={{ startMinutes: 585, endMinutes: 675 }}
                selectedDate={new Date(2026, 6, 30)}
                tasks={[]}
                assigningTaskId={null}
                onAssign={jest.fn()}
                onCreateNew={jest.fn()}
                onCancel={jest.fn()}
            />
        );
        getByText("9:45 AM – 11:15 AM");
        getByText("· 1h 30m");
    });

    test("tapping a card assigns that task", () => {
        const view = setup();
        fireEvent.press(view.getByText("Go for a run"));
        expect(view.onAssign).toHaveBeenCalledTimes(1);
        expect(view.onAssign).toHaveBeenCalledWith(taskB);
    });

    test("the card mid-assign ignores taps", () => {
        const view = setup({ assigningTaskId: "t1" });
        fireEvent.press(view.getByText("Write spec"));
        expect(view.onAssign).not.toHaveBeenCalled();

        fireEvent.press(view.getByText("Go for a run"));
        expect(view.onAssign).toHaveBeenCalledWith(taskB);
    });

    test("tapping New task opens the create flow", () => {
        const view = setup();
        fireEvent.press(view.getByText("New task"));
        expect(view.onCreateNew).toHaveBeenCalledTimes(1);
        expect(view.onAssign).not.toHaveBeenCalled();
    });

    test("with no unscheduled tasks the header and New task row still render", () => {
        const { getByText } = setup({ tasks: [] });
        getByText("9:30 AM – 10:30 AM");
        getByText("New task");
    });
});
