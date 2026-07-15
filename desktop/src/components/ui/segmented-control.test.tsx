import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SegmentedControl } from "./segmented-control";

describe("SegmentedControl", () => {
    it("renders options and reports the picked one", () => {
        const onChange = vi.fn();
        render(
            <SegmentedControl options={["System", "Light", "Dark"]} value="System" onChange={onChange} />,
        );

        expect(screen.getByText("System")).toBeTruthy();
        screen.getByText("Dark").click();
        expect(onChange).toHaveBeenCalledWith("Dark");
    });
});
