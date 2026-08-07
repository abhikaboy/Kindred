import { ThemedText } from "@/components/ThemedText";
import { ActivityHeatmap } from "@/components/activity/ActivityHeatmap";

export default function ActivityScreen() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 pt-6">
      <ThemedText type="titleFraunces" as="h1">
        Activity
      </ThemedText>

      <section className="rounded-2xl border border-border p-6">
        <ActivityHeatmap />
      </section>
    </div>
  );
}
