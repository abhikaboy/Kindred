import { cn } from "@/lib/utils";
import { ThemedText } from "@/components/ThemedText";
import { Switch } from "@/components/ui/switch";

type Props = {
    label: string;
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    disabled?: boolean;
    isLast?: boolean;
};

export function SettingsToggleRow({ label, checked, onCheckedChange, disabled, isLast }: Props) {
    return (
        <div
            className={cn(
                "flex min-h-11 items-center justify-between py-3.5",
                !isLast && "border-b border-border",
            )}
        >
            <ThemedText className="flex-1">{label}</ThemedText>
            <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
        </div>
    );
}
