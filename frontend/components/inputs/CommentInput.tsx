import { StyleSheet, View, useWindowDimensions } from "react-native";
import React, { useEffect } from "react";
import { useThemeColor } from "@/hooks/useThemeColor";
import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import MentionAutocomplete from "./MentionAutocomplete";
import { useMentionTrigger } from "@/hooks/useMentionTrigger";
import type { MentionCandidate } from "@/hooks/useFriendsForMention";

type Props = {
    onSubmit?: () => void;
    onChangeText?: (text: string) => void;
    placeHolder?: string;
    width?: number;
    value?: string;
    autoFocus?: boolean;
    onMentionsChange?: (mentions: { id: string; handle: string }[]) => void;
};

const CommentInput = (props: Props) => {
    const [internalValue, setInternalValue] = React.useState("");
    const ThemedColor = useThemeColor();
    const { width: windowWidth } = useWindowDimensions();

    // Use controlled value if provided, otherwise use internal state
    const value = props.value !== undefined ? props.value : internalValue;

    const setValue = (text: string) => {
        if (props.value !== undefined) {
            props.onChangeText?.(text);
        } else {
            setInternalValue(text);
            props.onChangeText?.(text);
        }
    };

    const { query, onChange, onSelection, onPick, picked } = useMentionTrigger(value, setValue);

    // Notify parent whenever picked changes
    useEffect(() => {
        props.onMentionsChange?.(picked.map((p) => ({ id: p.id, handle: p.handle })));
    }, [picked]);

    return (
        <View style={styles.container}>
            <MentionAutocomplete query={query} onPick={onPick} />
            <BottomSheetTextInput
                autoFocus={props.autoFocus}
                placeholder={props.placeHolder || "Leave a comment"}
                onSubmitEditing={props?.onSubmit}
                onChangeText={onChange}
                onSelectionChange={onSelection as any}
                value={value}
                multiline={false}
                returnKeyType="send"
                blurOnSubmit={true}
                style={{
                    backgroundColor: ThemedColor.background,
                    color: ThemedColor.text,
                    borderRadius: 100,
                    borderWidth: 1.3,
                    borderColor: ThemedColor.input,
                    paddingVertical: 12,
                    fontSize: 16,
                    fontFamily: "Outfit",
                    paddingHorizontal: 20,
                    flex: 1,
                    minWidth: Math.min(windowWidth * 0.7, 280),
                }}
                placeholderTextColor={ThemedColor.caption}
            />
        </View>
    );
};

export default CommentInput;

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
});
