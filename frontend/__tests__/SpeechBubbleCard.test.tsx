import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { ThemedText } from "@/components/ThemedText";
import SpeechBubbleCard from "@/components/cards/SpeechBubbleCard";

// CachedImage wraps expo-image; stub it so tests don't touch native modules.
jest.mock("@/components/CachedImage", () => "CachedImage");

jest.mock("expo-video", () => ({
    useVideoPlayer: () => ({}),
    VideoView: "VideoView",
}));
// KudosVideoPlayerModal positions its close button with safe-area insets.
jest.mock("react-native-safe-area-context", () => ({
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const sender = { name: "Sarah", picture: "https://x/a.png", id: "u1" };

describe("SpeechBubbleCard", () => {
    test("weaves the sender name into the title, with message and time", () => {
        const { getByText } = render(
            <SpeechBubbleCard
                sender={sender}
                title="commented on your post"
                message="great work!"
                timeLabel="5m ago"
            />,
        );
        // Name and phrase are separate nodes so the name can carry its own weight.
        getByText("Sarah");
        getByText(/commented on your post/);
        getByText("great work!");
        getByText("5m ago");
    });

    test("renders a namePrefix before the sender name", () => {
        const { getByText } = render(
            <SpeechBubbleCard sender={sender} namePrefix="To" timeLabel="now" />,
        );
        getByText(/To/);
        getByText("Sarah");
    });

    test("renders a context line beneath the title", () => {
        const { getByText } = render(
            <SpeechBubbleCard
                sender={sender}
                title="sent you encouragement"
                context={<ThemedText>Fitness · Morning run</ThemedText>}
                message="keep going!"
                timeLabel="now"
            />,
        );
        getByText("Fitness · Morning run");
        getByText(/sent you encouragement/);
    });

    test("fires onPress when the bubble is tapped", () => {
        const onPress = jest.fn();
        const { getByTestId } = render(
            <SpeechBubbleCard sender={sender} message="hi" timeLabel="now" onPress={onPress} />,
        );
        fireEvent.press(getByTestId("speech-bubble-card"));
        expect(onPress).toHaveBeenCalledTimes(1);
    });

    test("shows the unread dot only when read is false", () => {
        const unread = render(<SpeechBubbleCard sender={sender} message="hi" timeLabel="now" read={false} />);
        expect(unread.queryByTestId("unread-dot")).toBeTruthy();

        const read = render(<SpeechBubbleCard sender={sender} message="hi" timeLabel="now" read />);
        expect(read.queryByTestId("unread-dot")).toBeNull();
    });

    test("renders thumbnail only when thumbnailUri is provided", () => {
        const withThumb = render(
            <SpeechBubbleCard sender={sender} message="hi" timeLabel="now" thumbnailUri="https://x/post.png" />,
        );
        expect(withThumb.queryByTestId("bubble-thumbnail")).toBeTruthy();

        const without = render(<SpeechBubbleCard sender={sender} message="hi" timeLabel="now" />);
        expect(without.queryByTestId("bubble-thumbnail")).toBeNull();
    });

    test("renders the inline image (not message text) when imageUri is set", () => {
        const { getByTestId, queryByText } = render(
            <SpeechBubbleCard sender={sender} message="should be hidden" imageUri="https://x/img.png" timeLabel="now" />,
        );
        getByTestId("bubble-image");
        expect(queryByText("should be hidden")).toBeNull();
    });

    test("renders the video thumbnail with duration (not message text) when video props are set", () => {
        const { getByTestId, getByText, queryByText } = render(
            <SpeechBubbleCard
                sender={sender}
                message="should be hidden"
                videoUri="https://x/cheer.mp4"
                videoThumbnailUri="https://x/cheer-thumb.jpg"
                videoDurationMs={15000}
                timeLabel="now"
            />,
        );
        getByTestId("bubble-video");
        getByText("0:15");
        expect(queryByText("should be hidden")).toBeNull();
    });

    test("tapping the video thumbnail opens the fullscreen player", () => {
        const { getByTestId, queryByTestId } = render(
            <SpeechBubbleCard
                sender={sender}
                videoUri="https://x/cheer.mp4"
                videoThumbnailUri="https://x/cheer-thumb.jpg"
                timeLabel="now"
            />,
        );
        expect(queryByTestId("kudos-video-close")).toBeNull();
        fireEvent.press(getByTestId("bubble-video"));
        getByTestId("kudos-video-close");
    });

    test("renders the avatar badge only when a badge is provided", () => {
        const withBadge = render(
            <SpeechBubbleCard sender={sender} message="hi" timeLabel="now" badge={<ThemedText>★</ThemedText>} />,
        );
        expect(withBadge.queryByTestId("speech-bubble-badge")).toBeTruthy();

        const without = render(<SpeechBubbleCard sender={sender} message="hi" timeLabel="now" />);
        expect(without.queryByTestId("speech-bubble-badge")).toBeNull();
    });

    test("renders footerSlot beside the time", () => {
        const { getByText } = render(
            <SpeechBubbleCard
                sender={sender}
                message="hi"
                timeLabel="now"
                footerSlot={<ThemedText>Send congrats</ThemedText>}
            />,
        );
        getByText("Send congrats");
        getByText("now");
    });
});
