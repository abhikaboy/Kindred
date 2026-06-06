import React, { useEffect, useRef, useState } from "react";
import { View, Text, Keyboard, LayoutChangeEvent, useWindowDimensions } from "react-native";
import LongTextInput from "./LongTextInput";
import MentionAutocomplete from "./MentionAutocomplete";
import { useMentionTrigger } from "@/hooks/useMentionTrigger";
import type { MentionCandidate } from "@/hooks/useFriendsForMention";

type Props = {
    value: string;
    setValue: (v: string) => void;
    onMentionPicked: (candidate: MentionCandidate) => void;
    placeholder?: string;
    fontSize?: number;
    minHeight?: number;
};

const GAP = 4;

const MentionTextInput = ({
    value,
    setValue,
    onMentionPicked,
    placeholder,
    fontSize = 16,
    minHeight,
}: Props) => {
    const { query, caret, onChange, onSelection, onPick } = useMentionTrigger(value, setValue);
    const { height: windowHeight } = useWindowDimensions();
    const lineHeight = fontSize * 1.5;

    const containerRef = useRef<View>(null);
    const [lineBottomY, setLineBottomY] = useState(lineHeight);
    const [inputHeight, setInputHeight] = useState(0);
    const [popoverHeight, setPopoverHeight] = useState(0);
    const [pageY, setPageY] = useState(0);
    const [keyboardHeight, setKeyboardHeight] = useState(0);

    useEffect(() => {
        const show = Keyboard.addListener("keyboardDidShow", (e) => setKeyboardHeight(e.endCoordinates.height));
        const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardHeight(0));
        return () => {
            show.remove();
            hide.remove();
        };
    }, []);

    const handlePick = (c: MentionCandidate) => {
        onPick(c);
        onMentionPicked(c);
    };

    const onContainerLayout = (e: LayoutChangeEvent) => {
        setInputHeight(e.nativeEvent.layout.height);
        containerRef.current?.measureInWindow((_x, y) => setPageY(y));
    };

    // Decide whether to drop the popover below the caret line or flip it above.
    const lineTopY = lineBottomY - lineHeight;
    const belowBottomEdge = pageY + lineBottomY + GAP + popoverHeight;
    const availableBottom = windowHeight - keyboardHeight - 8;
    const flipAbove = popoverHeight > 0 && belowBottomEdge > availableBottom;

    return (
        <View ref={containerRef} style={{ position: "relative" }} onLayout={onContainerLayout}>
            <LongTextInput
                value={value}
                setValue={onChange}
                placeholder={placeholder}
                fontSize={fontSize}
                minHeight={minHeight}
                onSelectionChange={onSelection}
            />
            {/* Hidden mirror: matches the input's text layout so its height = bottom Y of the caret's line. */}
            <Text
                aria-hidden
                pointerEvents="none"
                onLayout={(e) => setLineBottomY(e.nativeEvent.layout.height)}
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    opacity: 0,
                    zIndex: -1,
                    fontSize,
                    fontFamily: "Outfit",
                    fontWeight: "400",
                    lineHeight,
                }}>
                {value.slice(0, caret) || " "}
            </Text>
            <MentionAutocomplete
                query={query}
                onPick={handlePick}
                top={flipAbove ? undefined : lineBottomY + GAP}
                bottom={flipAbove ? inputHeight - lineTopY + GAP : undefined}
                onMeasureHeight={setPopoverHeight}
            />
        </View>
    );
};

export default MentionTextInput;
