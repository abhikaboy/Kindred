import React from "react";
import { render } from "@testing-library/react-native";

// analyticsLayout imports AsyncStorage; stub it so the native module isn't touched.
jest.mock("@react-native-async-storage/async-storage", () => ({
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
    clear: jest.fn(() => Promise.resolve()),
}));

import { SignalStrip } from "@/components/analytics/SignalStrip";
import { StatusPill } from "@/components/analytics/StatusPill";
import { StatCards } from "@/components/analytics/StatCards";
import { TasksNeedingAttentionWidget } from "@/components/analytics/TasksNeedingAttentionWidget";
import {
    moveItem,
    sanitizeOrder,
    isWidgetId,
    DEFAULT_WIDGET_ORDER,
} from "@/components/analytics/analyticsLayout";
import {
    statusLabel,
    statusColor,
    heatmapLevelColor,
    directionColor,
} from "@/components/analytics/analyticsColors";
import type { AnalyticsSignals } from "@/api/analytics";

const themed: any = {
    primary: "#854DFF",
    success: "#22C55E",
    error: "#FF5C5F",
    warning: "#F59E0B",
    caption: "#919090",
    lightened: "#171626",
};

describe("analyticsLayout", () => {
    test("moveItem reorders without mutating the input", () => {
        const arr = ["a", "b", "c"];
        const moved = moveItem(arr, 0, 2);
        expect(moved).toEqual(["b", "c", "a"]);
        expect(arr).toEqual(["a", "b", "c"]);
    });

    test("moveItem ignores out-of-range moves", () => {
        expect(moveItem(["a", "b"], 0, 5)).toEqual(["a", "b"]);
    });

    test("sanitizeOrder drops unknowns and appends new widgets", () => {
        const result = sanitizeOrder(["heatmap", "bogus", "progress"]);
        expect(result.slice(0, 2)).toEqual(["heatmap", "progress"]);
        // every default widget ends up present exactly once
        expect(new Set(result)).toEqual(new Set(DEFAULT_WIDGET_ORDER));
        expect(result).toHaveLength(DEFAULT_WIDGET_ORDER.length);
    });

    test("isWidgetId validates membership", () => {
        expect(isWidgetId("progress")).toBe(true);
        expect(isWidgetId("nope")).toBe(false);
    });
});

describe("analyticsColors", () => {
    test("statusLabel maps kebab statuses to friendly copy", () => {
        expect(statusLabel("needs-attention")).toBe("Needs attention");
        expect(statusLabel("needs-reset")).toBe("Needs a reset");
        expect(statusLabel("healthy")).toBe("Healthy");
    });

    test("statusColor distinguishes slipping from healthy", () => {
        expect(statusColor("slipping", themed)).toBe(themed.error);
        expect(statusColor("healthy", themed)).toBe(themed.success);
    });

    test("heatmap level 0 is empty surface, level 4 is full primary", () => {
        expect(heatmapLevelColor(0, themed)).toBe(themed.lightened);
        expect(heatmapLevelColor(4, themed)).toBe(themed.primary);
        expect(heatmapLevelColor(0, themed)).not.toBe(heatmapLevelColor(4, themed));
    });

    test("directionColor reflects trend", () => {
        expect(directionColor("up", themed)).toBe(themed.success);
        expect(directionColor("down", themed)).toBe(themed.error);
        expect(directionColor("flat", themed)).toBe(themed.caption);
    });
});

describe("SignalStrip", () => {
    const signals: AnalyticsSignals = {
        momentum: { label: "Momentum", value: "34 done", rawValue: 34, delta: 18, deltaLabel: "+18% vs last week", direction: "up" },
        timing: { label: "Timing", value: "81%", rawValue: 81, delta: 9, deltaLabel: "+9 pts", direction: "up" },
        support: { label: "Support", value: "27 Kudos", rawValue: 27, delta: 6, deltaLabel: "+6 vs last week", direction: "up" },
    };

    test("renders all three signals", () => {
        const { getByText } = render(<SignalStrip signals={signals} />);
        getByText("Momentum");
        getByText("34 done");
        getByText("81%");
        getByText("27 Kudos");
    });
});

describe("StatusPill", () => {
    test("renders the friendly status label", () => {
        const { getByText } = render(<StatusPill status="slipping" />);
        getByText("Slipping");
    });
});

describe("StatCards", () => {
    test("renders label/value pairs", () => {
        const { getByText } = render(
            <StatCards
                items={[
                    { label: "Done", value: "8" },
                    { label: "On time", value: "68%" },
                ]}
            />,
        );
        getByText("Done");
        getByText("8");
        getByText("On time");
        getByText("68%");
    });
});

describe("TasksNeedingAttentionWidget", () => {
    test("shows an empty state when nothing is flagged", () => {
        const { getByText } = render(<TasksNeedingAttentionWidget attention={{ tasks: [] }} />);
        getByText(/Nothing needs attention/);
    });

    test("renders a flagged task with its reasons", () => {
        const attention: any = {
            tasks: [
                {
                    id: "1",
                    title: "Problem Set",
                    workspace: "School",
                    category: "Assignments",
                    categoryId: "c1",
                    daysOpen: 6,
                    reasons: ["No Kudos", "Open 6 days"],
                },
            ],
        };
        const { getByText } = render(<TasksNeedingAttentionWidget attention={attention} />);
        getByText("Problem Set");
        getByText("No Kudos");
    });
});
