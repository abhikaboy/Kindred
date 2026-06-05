import React from "react";
import { render, fireEvent } from "@testing-library/react-native";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock("@/contexts/tasksContext", () => ({
    useTasks: () => ({ setTask: jest.fn(), updateTask: jest.fn() }),
}));
jest.mock("@/contexts/dragContext", () => ({ useDragOptional: () => null }));
jest.mock("@/hooks/useAnalytics", () => ({ useAnalytics: () => ({ capture: jest.fn() }) }));
jest.mock("react-native-reanimated", () => {
    const RN = require("react-native");
    const Animated = {
        View: RN.View,
        Text: RN.Text,
        Image: RN.Image,
        createAnimatedComponent: (c: any) => c,
        addWhitelistedNativeProps: () => {},
    };
    return {
        __esModule: true,
        default: Animated,
        runOnJS: (fn: any) => fn,
        useSharedValue: (v: any) => ({ value: v }),
        useAnimatedStyle: () => ({}),
        useAnimatedReaction: () => {},
        withTiming: (v: any) => v,
        withSpring: (v: any) => v,
        Easing: { linear: (v: any) => v },
    };
});
jest.mock("react-native-gesture-handler", () => {
    const chain: any = {};
    chain.activateAfterLongPress = () => chain;
    chain.onStart = () => chain;
    chain.onUpdate = () => chain;
    chain.onEnd = () => chain;
    return {
        Gesture: { Pan: () => chain },
        GestureDetector: ({ children }: any) => children,
    };
});
jest.mock("@gorhom/bottom-sheet", () => ({
    BottomSheetTextInput: "TextInput",
    BottomSheet: "View",
    BottomSheetModal: "View",
    BottomSheetView: "View",
    BottomSheetScrollView: "ScrollView",
    useBottomSheetModal: () => ({ dismiss: jest.fn() }),
}));
jest.mock("@react-native-async-storage/async-storage", () => ({
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
    clear: jest.fn(() => Promise.resolve()),
}));
jest.mock("axios", () => ({ create: () => ({ get: jest.fn(), post: jest.fn(), interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } } }) }));
jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));

import TaskCard from "@/components/cards/TaskCard";

const baseProps = {
    content: "Run 5k",
    value: 10,
    priority: 1 as const,
    id: "task-1",
    categoryId: "cat-1",
};

describe("TaskCard post button", () => {
    beforeEach(() => {
        mockPush.mockClear();
    });

    test("does not render the post button when onPostPress is absent", () => {
        const { queryByTestId } = render(<TaskCard {...baseProps} />);
        expect(queryByTestId("task-card-post-button")).toBeNull();
    });

    test("renders the post button and calls onPostPress when pressed", () => {
        const onPostPress = jest.fn();
        const { getByTestId } = render(
            <TaskCard {...baseProps} onPostPress={onPostPress} />
        );
        fireEvent.press(getByTestId("task-card-post-button"));
        expect(onPostPress).toHaveBeenCalledTimes(1);
    });

    test("pressing the post button does not trigger the card's tap-to-redirect", () => {
        jest.useFakeTimers();
        try {
            const onPostPress = jest.fn();
            const { getByTestId } = render(
                <TaskCard
                    {...baseProps}
                    redirect={true}
                    task={{ id: "task-1", content: "Run 5k" } as any}
                    onPostPress={onPostPress}
                />
            );
            fireEvent.press(getByTestId("task-card-post-button"));
            // Flush the card's double-tap timeout + redirect debounce.
            jest.runAllTimers();
            expect(onPostPress).toHaveBeenCalledTimes(1);
            expect(mockPush).not.toHaveBeenCalled();
        } finally {
            jest.useRealTimers();
        }
    });
});
