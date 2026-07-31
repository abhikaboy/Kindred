import React from "react";
import { Text } from "react-native";
import { act, render } from "@testing-library/react-native";

const mockPresent = jest.fn();
const mockDismiss = jest.fn();

jest.mock("@gorhom/bottom-sheet", () => {
    const RN = require("react-native");
    const React = require("react");
    return {
        BottomSheetModal: React.forwardRef((props: any, ref: any) => {
            React.useImperativeHandle(ref, () => ({ present: mockPresent, dismiss: mockDismiss, snapToIndex: jest.fn() }));
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
    useTaskCreation: () => ({
        taskName: "",
        startDate: null,
        startTime: null,
        deadline: null,
        reminders: [],
        recurring: false,
        setCopySourceTaskId: jest.fn(),
    }),
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
jest.mock("@/components/modals/ModalHead", () => () => null);

import CreateModal from "@/components/modals/CreateModal";
import { CreateModalProvider, useCreateModal } from "@/contexts/createModalContext";

beforeEach(() => {
    mockPresent.mockClear();
    mockDismiss.mockClear();
});

describe("create modal open latency", () => {
    test("CreateModal presents on mount with no timer delay", () => {
        render(<CreateModal visible={true} setVisible={jest.fn()} />);
        expect(mockPresent).toHaveBeenCalledTimes(1);
        expect(mockDismiss).not.toHaveBeenCalled();
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
