import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SettingsToggleRow } from "./SettingsToggleRow";

describe("SettingsToggleRow", () => {
    it("renders the label and reports the flipped value on click", () => {
        const onChange = vi.fn();
        render(<SettingsToggleRow label="Friend Activity" checked={false} onCheckedChange={onChange} />);

        expect(screen.getByText("Friend Activity")).toBeTruthy();

        const toggle = screen.getByRole("switch");
        expect(toggle.getAttribute("aria-checked")).toBe("false");
        toggle.click();
        expect(onChange).toHaveBeenCalledWith(true);
    });
});
