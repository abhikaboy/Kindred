import React, { useState, useRef } from "react";
import { View, NativeSyntheticEvent, TextInputSelectionChangeEventData } from "react-native";
import LongTextInput from "./LongTextInput";
import MentionAutocomplete from "./MentionAutocomplete";
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
    const [selection, setSelection] = useState<{ start: number; end: number }>({ start: 0, end: 0 });
    const [query, setQuery] = useState<string | null>(null);
    const triggerStart = useRef<number | null>(null);

    const recomputeTrigger = (text: string, caret: number) => {
        for (let i = caret - 1; i >= 0; i--) {
            const ch = text[i];
            if (ch === "@") {
                const prev = i === 0 ? " " : text[i - 1];
                if (/\s/.test(prev) || i === 0) {
                    triggerStart.current = i;
                    setQuery(text.slice(i + 1, caret));
                    return;
                }
            }
            if (/\s/.test(ch)) break;
        }
        triggerStart.current = null;
        setQuery(null);
    };

    const handleChange = (text: string) => {
        setValue(text);
        recomputeTrigger(text, selection.start);
    };

    const handleSelection = (e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
        const sel = e.nativeEvent.selection;
        setSelection(sel);
        recomputeTrigger(value, sel.start);
    };

    const handlePick = (c: MentionCandidate) => {
        if (triggerStart.current === null) return;
        const before = value.slice(0, triggerStart.current);
        const after = value.slice(selection.start);
        const insertion = `@${c.handle} `;
        const next = before + insertion + after;
        setValue(next);
        onMentionPicked(c);
        triggerStart.current = null;
        setQuery(null);
    };

    return (
        <View>
            <LongTextInput
                value={value}
                setValue={handleChange}
                placeholder={placeholder}
                fontSize={fontSize}
                minHeight={minHeight}
                onSelectionChange={handleSelection}
            />
            <MentionAutocomplete query={query} onPick={handlePick} />
        </View>
    );
};

export default MentionTextInput;
