import { cn } from "@/lib/utils";
import { ThemedText } from "@/components/ThemedText";

type SegmentedControlProps = {
    options: string[];
    value: string;
    onChange: (option: string) => void;
    /** Light-purple active segment with primary label (vs. the default neutral segment). */
    accent?: boolean;
    className?: string;
};

// Port of the mobile SegmentedControl: a rounded pill with a sliding active box.
export function SegmentedControl({ options, value, onChange, accent, className }: SegmentedControlProps) {
    const idx = Math.max(0, options.indexOf(value));
    const n = options.length;

    return (
        <div
            className={cn(
                "relative flex w-full rounded-full border border-border bg-background p-1",
                className,
            )}
        >
            {/* Sliding active segment. Track inner width = 100% - 8px (the p-1 gutter). */}
            <div
                className={cn(
                    "absolute inset-y-1 rounded-full transition-[left] duration-200 ease-out",
                    accent ? "bg-primary/15" : "bg-secondary",
                )}
                style={{
                    width: `calc((100% - 8px) / ${n})`,
                    left: `calc(4px + ${idx} * (100% - 8px) / ${n})`,
                }}
                aria-hidden
            />
            {options.map((option) => {
                const focused = option === value;
                return (
                    <button
                        key={option}
                        type="button"
                        onClick={() => onChange(option)}
                        className="relative z-10 flex-1 rounded-full py-2 text-center"
                    >
                        <ThemedText
                            type={focused ? "defaultSemiBold" : "default"}
                            className={cn(
                                "text-sm",
                                focused
                                    ? accent
                                        ? "text-primary"
                                        : "text-foreground"
                                    : "text-muted-foreground",
                            )}
                        >
                            {option}
                        </ThemedText>
                    </button>
                );
            })}
        </div>
    );
}
