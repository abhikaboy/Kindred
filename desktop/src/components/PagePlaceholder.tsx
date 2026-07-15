import { ThemedText } from "@/components/ThemedText";

// Minimal page shell used by the skeleton routes until each screen is built out.
export function PagePlaceholder({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-2">
      <ThemedText type="titleFraunces" as="h1">
        {title}
      </ThemedText>
      <ThemedText type="caption">{description ?? "Coming soon."}</ThemedText>
    </div>
  );
}
