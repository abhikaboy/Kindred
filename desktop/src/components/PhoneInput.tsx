import React, { useState } from "react";

type Props = {
    value: string;
    onChangeText: (e164: string) => void;
    placeholder?: string;
    autoFocus?: boolean;
};

const DIAL_CODES = [
    { code: "+1", label: "United States / Canada +1" },
    { code: "+44", label: "United Kingdom +44" },
    { code: "+61", label: "Australia +61" },
    { code: "+91", label: "India +91" },
];

export function PhoneInput({
    value: _value,
    onChangeText,
    placeholder = "(555) 123-4567",
    autoFocus = false,
}: Props): React.JSX.Element {
    const [dialCode, setDialCode] = useState("+1");
    const [digits, setDigits] = useState("");

    const emit = (nextDial: string, nextDigits: string) => {
        onChangeText(`${nextDial}${nextDigits}`);
    };

    const handleDigits = (raw: string) => {
        const cleaned = raw.replace(/\D/g, "");
        setDigits(cleaned);
        emit(dialCode, cleaned);
    };

    const handleDialCode = (next: string) => {
        setDialCode(next);
        emit(next, digits);
    };

    const displayValue = () => {
        if (dialCode !== "+1" || digits.length === 0) return digits;
        const d = digits.slice(0, 10);
        if (d.length <= 3) return `(${d}`;
        if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
        return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6, 10)}`;
    };

    return (
        <div className="flex items-center bg-secondary rounded-2xl pl-5">
            <select
                value={dialCode}
                onChange={(e) => handleDialCode(e.target.value)}
                className="bg-transparent text-foreground font-sans font-medium text-lg outline-none py-5 pr-3 cursor-pointer"
                aria-label="Country dial code"
            >
                {DIAL_CODES.map((opt) => (
                    <option key={opt.code} value={opt.code}>
                        {opt.code}
                    </option>
                ))}
            </select>

            <input
                type="tel"
                inputMode="tel"
                value={displayValue()}
                onChange={(e) => handleDigits(e.target.value)}
                placeholder={placeholder}
                autoFocus={autoFocus}
                maxLength={14}
                className="flex-1 bg-transparent text-foreground font-sans text-lg py-5 pr-6 outline-none placeholder:text-muted-foreground"
            />
        </div>
    );
}
