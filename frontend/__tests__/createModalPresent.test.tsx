import React from "react";
import { Text } from "react-native";
import { act, render } from "@testing-library/react-native";

const mockPresent = jest.fn();
const mockDismiss = jest.fn();
const mockSnapToIndex = jest.fn();
const mockSetCopySource = jest.fn();
// Last props the sheet was rendered with, so tests can fire its onChange
const mockSheetProps: { current: any } = { current: null };

jest.mock("@gorhom/bottom-sheet", () => {
    const RN = require("react-native");
    const React = require("react");
    return {
        BottomSheetModal: React.forwardRef((props: any, ref: any) => {
            mockSheetProps.current = props;
            React.useImperativeHandle(ref, () => ({
                present: mockPresent,
                dismiss: mockDismiss,
                snapToIndex: mockSnapToIndex,
            }));
            return React.createElement(RN.View, null, props.children);
        }),
        BottomSheetBackdrop: () => null,
        BottomSheetScrollView: RN.ScrollView,
        useBottomSheetSpringConfigs: (c: any) => c,
    };
});

jest.mock("@/hooks/useThemeColor", () => ({
    useThemeColor: () => ({ text: "#000", background: "#fff" }),
}));

jest.mock("@/contexts/taskCreationContext", () => ({
    useTaskCreation: () => ({ setCopySourceTaskId: mockSetCopySource }),
}));

jest.mock("@/hooks/useAnalytics", () => ({ useAnalytics: () => ({ capture: jest.fn() }) }));
jest.mock("expo-haptics", () => ({ impactAsync: jest.fn(), ImpactFeedbackStyle: { Light: "light" } }));
jest.mock("@/components/modals/create/Standard", () => () => null);
jest.mock("@/components/modals/create/NewCategory", () => () => null);
jest.mock("@/components/modals/create/SelectWorkspace", () => () => null);
jest.mock("@/components/modals/create/Deadline", () => () => null);
jest.mock("@/components/modals/create/Recurring", () => () => null);
jest.mock("@/components/modals/create/StartDate", () => () => null);
jest.mock("@/components/modals/create/Reminder", () => () => null);
jest.mock("@/components/modals/create/Collaborators", () => () => null);
jest.mock("@/components/modals/create/Integration", () => () => null);

import CreateModal from "@/components/modals/CreateModal";
import { CreateModalProvider, useCreateModal } from "@/contexts/createModalContext";

beforeEach(() => {
    mockPresent.mockClear();
    mockDismiss.mockClear();
    mockSnapToIndex.mockClear();
    mockSetCopySource.mockClear();
    mockSheetProps.current = null;
});

describe("create modal open latency", () => {
    test("CreateModal presents on mount with no timer delay", () => {
        render(<CreateModal visible={true} setVisible={jest.fn()} />);
        expect(mockPresent).toHaveBeenCalledTimes(1);
        expect(mockDismiss).not.toHaveBeenCalled();
    });

    test("does not re-snap on mount, which would race the present animation", () => {
        render(<CreateModal visible={true} setVisible={jest.fn()} />);
        expect(mockSnapToIndex).not.toHaveBeenCalled();
    });

    test("openModal flips visible synchronously", () => {
        let open: () => void = () => {};
        const Probe = () => {
            const { visible, openModal } = useCreateModal();
            open = openModal;
            return <Text>{visible ? "open" : "closed"}</Text>;
        };
        const { getByText } = render(
            <CreateModalProvider>
                <Probe />
            </CreateModalProvider>
        );
        getByText("closed");
        act(() => open());
        getByText("open");
    });
});

describe("create modal close", () => {
    test("stays mounted until the close animation lands", () => {
        const setVisible = jest.fn();
        render(<CreateModal visible={true} setVisible={setVisible} />);
        // Nothing reports closed just because the sheet was asked to dismiss
        expect(setVisible).not.toHaveBeenCalled();
    });

    test("settling at index -1 reports closed and clears the copy source", () => {
        const setVisible = jest.fn();
        render(<CreateModal visible={true} setVisible={setVisible} />);
        act(() => mockSheetProps.current.onChange(-1));
        expect(setVisible).toHaveBeenCalledWith(false);
        expect(mockSetCopySource).toHaveBeenCalledWith(null);
    });

    test("settling at a real index does not report closed", () => {
        const setVisible = jest.fn();
        render(<CreateModal visible={true} setVisible={setVisible} />);
        act(() => mockSheetProps.current.onChange(0));
        expect(setVisible).not.toHaveBeenCalled();
        expect(mockSetCopySource).not.toHaveBeenCalled();
    });

    test("controlled use dismisses when visible goes false", () => {
        const { rerender } = render(<CreateModal visible={true} setVisible={jest.fn()} />);
        expect(mockDismiss).not.toHaveBeenCalled();
        rerender(<CreateModal visible={false} setVisible={jest.fn()} />);
        expect(mockDismiss).toHaveBeenCalledTimes(1);
    });
});
