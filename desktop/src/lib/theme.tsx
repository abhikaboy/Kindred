import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type Theme = "light" | "dark";
export type ThemePreference = "system" | "light" | "dark";

const STORAGE_KEY = "kindred-theme";

type ThemeContextValue = {
    /** Resolved theme actually applied to the document. */
    theme: Theme;
    /** User's stored choice — "system" follows the OS. */
    preference: ThemePreference;
    setTheme: (t: Theme) => void;
    setPreference: (p: ThemePreference) => void;
    toggle: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function systemIsDark(): boolean {
    if (typeof window === "undefined") return false;
    return Boolean(window.matchMedia?.("(prefers-color-scheme: dark)").matches);
}

function getInitialPreference(): ThemePreference {
    if (typeof window === "undefined") return "system";
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
    return "system";
}

export function ThemeProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
    const [preference, setPreference] = useState<ThemePreference>(getInitialPreference);
    const [sysDark, setSysDark] = useState<boolean>(systemIsDark);

    const theme: Theme = preference === "system" ? (sysDark ? "dark" : "light") : preference;

    // Apply resolved theme to <html>, persist the preference (not the resolved value).
    useEffect(() => {
        if (typeof document !== "undefined") {
            document.documentElement.classList.toggle("dark", theme === "dark");
        }
        if (typeof window !== "undefined") {
            window.localStorage.setItem(STORAGE_KEY, preference);
        }
    }, [theme, preference]);

    // Track OS changes so "system" mode stays live.
    useEffect(() => {
        if (typeof window === "undefined" || !window.matchMedia) return;
        const mq = window.matchMedia("(prefers-color-scheme: dark)");
        const onChange = () => setSysDark(mq.matches);
        mq.addEventListener?.("change", onChange);
        return () => mq.removeEventListener?.("change", onChange);
    }, []);

    const value = useMemo<ThemeContextValue>(
        () => ({
            theme,
            preference,
            setTheme: (t) => setPreference(t),
            setPreference,
            toggle: () => setPreference(theme === "dark" ? "light" : "dark"),
        }),
        [theme, preference],
    );

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
    return ctx;
}
