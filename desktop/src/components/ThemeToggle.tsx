import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme";

export function ThemeToggle() {
    const { theme, toggle } = useTheme();
    const isDark = theme === "dark";
    return (
        <button
            type="button"
            onClick={toggle}
            aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
            className="size-9 rounded-md hover:bg-muted text-foreground grid place-items-center"
        >
            {isDark ? <Sun className="size-5" /> : <Moon className="size-5" />}
        </button>
    );
}
