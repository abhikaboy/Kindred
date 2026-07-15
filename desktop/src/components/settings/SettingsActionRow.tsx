import { CaretRight } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { ThemedText } from "@/components/ThemedText";

type Props = {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
    showChevron?: boolean;
    destructive?: boolean;
    disabled?: boolean;
};

export function SettingsActionRow({ label, onClick, icon, showChevron, destructive, disabled }: Props) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={cn(
                "flex w-full items-center justify-between border-b border-border py-3.5 text-left transition-opacity",
                "last:border-b-0 hover:opacity-70 disabled:cursor-not-allowed disabled:opacity-50",
            )}
        >
            <ThemedText className={destructive ? "text-destructive" : undefined}>{label}</ThemedText>
            <span className="flex items-center gap-2">
                {icon}
                {showChevron && <CaretRight className="size-4 text-muted-foreground" weight="bold" />}
            </span>
        </button>
    );
}
