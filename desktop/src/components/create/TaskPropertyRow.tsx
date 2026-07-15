import type { ReactNode } from "react";
import { ThemedText } from "@/components/ThemedText";

// A labeled property line for the create dialog. Left-aligned label, control on the right.
export function TaskPropertyRow({
    label,
    children,
}: {
    label: string;
    children: ReactNode;
}) {
    return (
        <div className="flex items-center justify-between gap-3">
            <ThemedText type="caption" className="shrink-0 text-muted-foreground">
                {label}
            </ThemedText>
            <div className="flex min-w-0 items-center gap-2">{children}</div>
        </div>
    );
}
