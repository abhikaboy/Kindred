import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { ThemeProvider, useTheme } from "@/lib/theme";

function Consumer() {
    const { theme, toggle } = useTheme();
    return (
        <button onClick={toggle} data-testid="toggle">
            {theme}
        </button>
    );
}

describe("theme", () => {
    beforeEach(() => {
        localStorage.clear();
        document.documentElement.classList.remove("dark");
    });

    it("toggle flips the dark class and persists to localStorage", () => {
        render(
            <ThemeProvider>
                <Consumer />
            </ThemeProvider>,
        );

        const startedDark = document.documentElement.classList.contains("dark");

        act(() => screen.getByTestId("toggle").click());

        expect(document.documentElement.classList.contains("dark")).toBe(!startedDark);
        expect(localStorage.getItem("kindred-theme")).toBe(!startedDark ? "dark" : "light");

        act(() => screen.getByTestId("toggle").click());

        expect(document.documentElement.classList.contains("dark")).toBe(startedDark);
        expect(localStorage.getItem("kindred-theme")).toBe(startedDark ? "dark" : "light");
    });
});
