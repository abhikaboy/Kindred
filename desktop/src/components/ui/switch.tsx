import { cn } from "@/lib/utils";

type SwitchProps = {
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    id?: string;
    disabled?: boolean;
    className?: string;
};

// Kindred toggle: purple track when on, white thumb. No radix dep needed.
export function Switch({ checked, onCheckedChange, id, disabled, className }: SwitchProps) {
    return (
        <button
            type="button"
            role="switch"
            id={id}
            aria-checked={checked}
            disabled={disabled}
            onClick={() => onCheckedChange(!checked)}
            className={cn(
                "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                "disabled:cursor-not-allowed disabled:opacity-50",
                checked ? "bg-primary" : "bg-input",
                className,
            )}
        >
            <span
                className={cn(
                    "inline-block size-5 rounded-full bg-white shadow transition-transform",
                    checked ? "translate-x-[22px]" : "translate-x-0.5",
                )}
            />
        </button>
    );
}
