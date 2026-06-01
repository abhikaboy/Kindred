import React from "react";
import { View } from "react-native";
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

const MentionTextInput = ({ value, setValue, onMentionPicked, placeholder, fontSize, minHeight }: Props) => {
    const { query, onChange, onSelection, onPick } = useMentionTrigger(value, setValue);

    const handlePick = (c: MentionCandidate) => {
        onPick(c);
        onMentionPicked(c);
    };

    return (
        <View>
            <LongTextInput
                value={value}
                setValue={onChange}
                placeholder={placeholder}
                fontSize={fontSize}
                minHeight={minHeight}
                onSelectionChange={onSelection}
            />
            <MentionAutocomplete query={query} onPick={handlePick} />
        </View>
    );
};

export default MentionTextInput;
