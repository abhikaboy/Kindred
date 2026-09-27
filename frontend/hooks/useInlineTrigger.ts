import { useRef, useState } from "react";
import type { NativeSyntheticEvent, TextInputSelectionChangeEventData } from "react-native";

export type InlineToken = { char: string; query: string };

/**
 * Tracks a trigger token ("#health", "@sam") under the caret in a text field.
 * A trigger only counts at the start of a word, and the token ends at the
 * first whitespace. `replace` swaps the whole token for new text.
 */
export function useInlineTrigger(value: string, setValue: (v: string) => void, chars: string[]) {
    const [caret, setCaret] = useState(0);
    const [token, setToken] = useState<InlineToken | null>(null);
    const tokenStart = useRef<number | null>(null);

    const recompute = (text: string, at: number) => {
        for (let i = at - 1; i >= 0; i--) {
            const ch = text[i];
            if (chars.includes(ch) && (i === 0 || /\s/.test(text[i - 1]))) {
                tokenStart.current = i;
                setToken({ char: ch, query: text.slice(i + 1, at) });
                return;
            }
            if (/\s/.test(ch)) break;
        }
        tokenStart.current = null;
        setToken(null);
    };

    const onChangeText = (text: string) => {
        setValue(text);
        // The selection event that follows corrects a caret that lags one keystroke
        recompute(text, Math.min(text.length, caret + Math.max(0, text.length - value.length)));
    };

    const onSelectionChange = (e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
        const at = e.nativeEvent.selection.start;
        setCaret(at);
        recompute(value, at);
    };

    /** Replace the token under the caret; "" removes it along with one adjoining space. */
    const replace = (replacement: string) => {
        const start = tokenStart.current;
        if (start === null) return;
        let before = value.slice(0, start);
        let after = value.slice(caret);
        if (!replacement) {
            if (before.endsWith(" ") && (after === "" || after.startsWith(" "))) before = before.slice(0, -1);
            else if (after.startsWith(" ")) after = after.slice(1);
        }
        setValue(before + replacement + after);
        tokenStart.current = null;
        setToken(null);
    };

    const clear = () => {
        tokenStart.current = null;
        setToken(null);
    };

    return { token, onChangeText, onSelectionChange, replace, clear };
}
