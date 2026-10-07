import { cn } from "@/lib/utils";
import { ThemedText } from "@/components/ThemedText";

type Props = {
    title: string;
    children: React.ReactNode;
    className?: string;
};

export function SettingsSection({ title, children, className }: Props) {
    return (
        <section className={cn("mb-12", className)}>
            <ThemedText as="h2" type="larger_default" className="mb-3 block">
                {title}
            </ThemedText>
            {children}
        </section>
    );
}
