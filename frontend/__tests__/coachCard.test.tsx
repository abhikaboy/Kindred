import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { CoachCard } from "@/components/onboarding/CoachCard";

describe("CoachCard", () => {
    test("renders title and body with default testID", () => {
        const { getByTestId, getByText } = render(
            <CoachCard title="Add a task" body="Tap the plus button" visible />
        );
        expect(getByTestId("onboarding-coach")).toBeTruthy();
        expect(getByTestId("onboarding-coach-copy").props.children).toBe("Add a task");
        expect(getByText("Tap the plus button")).toBeTruthy();
    });

    test("accent dot renders only when given", () => {
        const withDot = render(<CoachCard title="Plan" accentColor="#f00" visible />);
        expect(withDot.getByTestId("onboarding-coach-accent")).toBeTruthy();
        expect(render(<CoachCard title="Plan" visible />).queryByTestId("onboarding-coach-accent")).toBeNull();
    });

    test("hides body when absent", () => {
        const { queryByText } = render(<CoachCard title="Add a task" visible />);
        expect(queryByText("Tap the plus button")).toBeNull();
    });

    test("shows dots only when step is given", () => {
        const withStep = render(<CoachCard title="T" step={{ index: 1, total: 5 }} visible />);
        expect(withStep.getByTestId("onboarding-coach-dots").children).toHaveLength(5);
        const without = render(<CoachCard title="T" visible />);
        expect(without.queryByTestId("onboarding-coach-dots")).toBeNull();
    });

    test("action and skip fire with custom testID", () => {
        const onAction = jest.fn();
        const onSkip = jest.fn();
        const { getByTestId } = render(
            <CoachCard title="T" actionLabel="Next" onAction={onAction} onSkip={onSkip} visible testID="step" />
        );
        fireEvent.press(getByTestId("step-action"));
        fireEvent.press(getByTestId("step-skip"));
        expect(onAction).toHaveBeenCalledTimes(1);
        expect(onSkip).toHaveBeenCalledTimes(1);
    });

    test("footer hidden when neither skip nor action", () => {
        const { queryByTestId, queryByText } = render(<CoachCard title="T" visible />);
        expect(queryByTestId("onboarding-coach-action")).toBeNull();
        expect(queryByTestId("onboarding-coach-skip")).toBeNull();
        expect(queryByText("Skip")).toBeNull();
    });
});
