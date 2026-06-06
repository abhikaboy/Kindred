import { useState, useRef } from "react";
import type { NativeSyntheticEvent, TextInputSelectionChangeEventData } from "react-native";
import type { MentionCandidate } from "./useFriendsForMention";
import { formatHandle } from "@/utils/handle";

export const useMentionTrigger = (value: string, setValue: (v: string) => void) => {
    const [selection, setSelection] = useState<{ start: number; end: number }>({ start: 0, end: 0 });
    const [query, setQuery] = useState<string | null>(null);
    const [picked, setPicked] = useState<MentionCandidate[]>([]);
    const triggerStart = useRef<number | null>(null);

    const recompute = (text: string, caret: number) => {
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

    const onChange = (text: string) => {
        setValue(text);
        recompute(text, selection.start);
    };

    const onSelection = (e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
        const sel = e.nativeEvent.selection;
        setSelection(sel);
        recompute(value, sel.start);
    };

    const onPick = (c: MentionCandidate) => {
        if (triggerStart.current === null) return;
        const before = value.slice(0, triggerStart.current);
        const after = value.slice(selection.start);
        setValue(before + `${formatHandle(c.handle)} ` + after);
        setPicked((p) => (p.find((x) => x.id === c.id) ? p : [...p, c]));
        triggerStart.current = null;
        setQuery(null);
    };

    return { query, caret: selection.start, onChange, onSelection, onPick, picked, setPicked };
};
