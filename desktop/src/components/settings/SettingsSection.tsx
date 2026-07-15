import { cn } from "@/lib/utils";
import { ThemedText } from "@/components/ThemedText";

type Props = {
    title: string;
    children: React.ReactNode;
    className?: string;
};

export function SettingsSection({ title, children, className }: Props) {
    return (
        <section className={cn("mb-10", className)}>
            <ThemedText as="h2" type="caption" className="mb-4 block tracking-wider">
                {title}
            </ThemedText>
            {children}
        </section>
    );
}
