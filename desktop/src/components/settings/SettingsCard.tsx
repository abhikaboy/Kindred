import { cn } from "@/lib/utils";

// Flat container that groups settings rows (dividers handled by the rows).
export function SettingsCard({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={cn("rounded-xl bg-background px-5 py-1", className)}>
            {children}
        </div>
    );
}
