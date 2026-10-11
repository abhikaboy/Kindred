import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { PostingLessonOverlay } from "@/components/onboarding/PostingLessonOverlay";
import { registerCoachAnchor } from "@/utils/onboardingV2/coachAnchors";
import type { LessonStep } from "@/utils/postingLesson/machine";

// Reanimated v4 pulls in react-native-worklets at import time, which crashes under jest
jest.mock("react-native-worklets", () => require("react-native-worklets/src/mock"));
jest.mock("react-native-reanimated", () => require("react-native-reanimated/mock"));
jest.mock("react-native-safe-area-context", () => ({
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

let mockStep: LessonStep | null = null;
let mockGuest = false;
const mockSkip = jest.fn();
const mockAdvance = jest.fn();

jest.mock("@/contexts/PostingLessonContext", () => ({
    usePostingLesson: () => ({ step: mockStep, skip: mockSkip, advance: mockAdvance, finish: jest.fn(), tryStart: jest.fn(), toastGone: jest.fn() }),
}));
jest.mock("@/hooks/useIsGuest", () => ({ useIsGuest: () => mockGuest }));

const anchor = (key: Parameters<typeof registerCoachAnchor>[0]) => {
    const node = { measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => cb(20, 600, 80, 80) };
    return registerCoachAnchor(key, { current: node } as never);
};

beforeEach(() => {
    mockStep = null;
    mockGuest = false;
    mockSkip.mockClear();
    mockAdvance.mockClear();
});

test("renders nothing when the lesson isn't running", () => {
    const { queryByTestId } = render(<PostingLessonOverlay />);
    expect(queryByTestId("posting-lesson")).toBeNull();
});

describe("toast step", () => {
    test("blurs the screen and explains the toast", () => {
        mockStep = "toast";
        const { getByTestId, getByText } = render(<PostingLessonOverlay />);
        expect(getByTestId("coach-backdrop")).toBeTruthy();
        getByText("Share your win");
        getByText("Posting is how your friends send you kudos after you finish something. Tap the toast above to post.");
    });

    test("tapping the dimmed screen dismisses the lesson", () => {
        mockStep = "toast";
        const { getByTestId } = render(<PostingLessonOverlay />);
        fireEvent.press(getByTestId("posting-lesson-scrim"));
        expect(mockSkip).toHaveBeenCalledTimes(1);
    });
});

describe("screen steps", () => {
    test("camera points at the shutter", async () => {
        mockStep = "camera";
        const off = anchor("postShutter");
        const { findByText } = render(<PostingLessonOverlay />);
        await findByText("Snap a photo of your win");
        off();
    });

    test("caption has a Next that moves to the post step", async () => {
        mockStep = "caption";
        const off = anchor("postCaption");
        const { findByText } = render(<PostingLessonOverlay />);
        await findByText("Say a few words");
        fireEvent.press(await findByText("Next"));
        expect(mockAdvance).toHaveBeenCalledWith("post");
        off();
    });

    test("the post step tells a guest an account comes first", async () => {
        mockStep = "post";
        mockGuest = true;
        const off = anchor("postButton");
        const { findByText } = render(<PostingLessonOverlay />);
        await findByText("Tap Post. You'll make an account first so your friends can see it.");
        off();
    });

    test("the post step for a member just says to post", async () => {
        mockStep = "post";
        const off = anchor("postButton");
        const { findByText } = render(<PostingLessonOverlay />);
        await findByText("Tap Post to share this with your friends.");
        off();
    });

    test("Skip dismisses", async () => {
        mockStep = "camera";
        const off = anchor("postShutter");
        const { findByText } = render(<PostingLessonOverlay />);
        fireEvent.press(await findByText("Skip"));
        expect(mockSkip).toHaveBeenCalled();
        off();
    });
});
