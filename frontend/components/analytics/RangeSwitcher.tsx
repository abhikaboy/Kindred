import React from "react";
import SegmentedControl from "@/components/ui/SegmentedControl";
import { AnalyticsRange } from "@/api/analytics";

const OPTIONS: { label: string; range: AnalyticsRange }[] = [
    { label: "W", range: "week" },
    { label: "M", range: "month" },
    { label: "6M", range: "sixmonth" },
];

export function RangeSwitcher({ range, onChange }: { range: AnalyticsRange; onChange: (r: AnalyticsRange) => void }) {
    const selectedLabel = OPTIONS.find((o) => o.range === range)?.label ?? "W";
    return (
        <SegmentedControl
            options={OPTIONS.map((o) => o.label)}
            selectedOption={selectedLabel}
            size="small"
            accent
            onOptionPress={(opt) => {
                const match = OPTIONS.find((o) => o.label === opt);
                if (match) onChange(match.range);
            }}
        />
    );
}
