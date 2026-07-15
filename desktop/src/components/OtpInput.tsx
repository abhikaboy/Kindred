import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
    numberOfDigits?: number;
    onTextChange: (text: string) => void;
    onFilled?: (text: string) => void;
    disabled?: boolean;
    autoFocus?: boolean;
};

export function OtpInput({
    numberOfDigits = 4,
    onTextChange,
    onFilled,
    disabled = false,
    autoFocus = true,
}: Props): React.JSX.Element {
    const [chars, setChars] = useState<string[]>(() => Array(numberOfDigits).fill(""));
    const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
    const filledRef = useRef(false);

    useEffect(() => {
        if (autoFocus) inputsRef.current[0]?.focus();
    }, [autoFocus]);

    const commit = (next: string[]) => {
        setChars(next);
        const joined = next.join("");
        onTextChange(joined);
        const complete = next.every((c) => c !== "");
        if (complete && !filledRef.current) {
            filledRef.current = true;
            onFilled?.(joined);
        } else if (!complete) {
            filledRef.current = false;
        }
    };

    const focusBox = (index: number) => {
        const el = inputsRef.current[index];
        if (el) {
            el.focus();
            el.select();
        }
    };

    const handleChange = (index: number, raw: string) => {
        const cleaned = raw.replace(/\D/g, "");

        // Paste / multi-char: distribute across boxes starting at index.
        if (cleaned.length > 1) {
            const next = [...chars];
            let cursor = index;
            for (const ch of cleaned) {
                if (cursor >= numberOfDigits) break;
                next[cursor] = ch;
                cursor++;
            }
            commit(next);
            focusBox(Math.min(cursor, numberOfDigits - 1));
            return;
        }

        const next = [...chars];
        next[index] = cleaned;
        commit(next);
        if (cleaned && index < numberOfDigits - 1) {
            focusBox(index + 1);
        }
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Backspace") {
            if (chars[index]) {
                const next = [...chars];
                next[index] = "";
                commit(next);
            } else if (index > 0) {
                e.preventDefault();
                const next = [...chars];
                next[index - 1] = "";
                commit(next);
                focusBox(index - 1);
            }
        } else if (e.key === "ArrowLeft" && index > 0) {
            e.preventDefault();
            focusBox(index - 1);
        } else if (e.key === "ArrowRight" && index < numberOfDigits - 1) {
            e.preventDefault();
            focusBox(index + 1);
        }
    };

    return (
        <div className="flex gap-2 justify-center">
            {chars.map((char, index) => (
                <input
                    key={index}
                    ref={(el) => {
                        inputsRef.current[index] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={char}
                    disabled={disabled}
                    onChange={(e) => handleChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    onFocus={(e) => e.currentTarget.select()}
                    className={cn(
                        "size-16 rounded-2xl bg-secondary border-2 border-transparent",
                        "text-center text-3xl font-sans font-semibold text-foreground",
                        "outline-none focus:border-primary transition-colors",
                        disabled && "opacity-50 cursor-not-allowed"
                    )}
                />
            ))}
        </div>
    );
}
