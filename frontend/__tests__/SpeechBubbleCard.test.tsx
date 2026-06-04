import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { ThemedText } from "@/components/ThemedText";
import SpeechBubbleCard from "@/components/cards/SpeechBubbleCard";

// CachedImage wraps expo-image; stub it so tests don't touch native modules.
jest.mock("@/components/CachedImage", () => "CachedImage");

const sender = { name: "Sarah", picture: "https://x/a.png", id: "u1" };

describe("SpeechBubbleCard", () => {
    test("renders header, message and time", () => {
        const { getByText } = render(
            <SpeechBubbleCard
                sender={sender}
                header={<ThemedText>commented on your post</ThemedText>}
                message="great work!"
                timeLabel="5m ago"
            />,
        );
        getByText("Sarah");
        getByText("commented on your post");
        getByText("great work!");
        getByText("5m ago");
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
