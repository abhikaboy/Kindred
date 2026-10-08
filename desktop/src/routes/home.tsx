import { Link } from "react-router-dom";
import { useState } from "react";
import { ArrowLeft, CaretRight } from "@phosphor-icons/react";
import { HomeStage } from "@/components/home/stage/HomeStage";
import { ThemedText } from "@/components/ThemedText";
import { WelcomeHeader } from "@/components/home/WelcomeHeader";
import { TodayHero } from "@/components/home/TodayHero";
import { WorkingOnRow } from "@/components/home/WorkingOnRow";
import { TodaySection } from "@/components/home/TodaySection";
import { PersonalWorkspaces } from "@/components/home/PersonalWorkspaces";
import { SectionHeader } from "@/components/home/SectionHeader";
import { WeekRecapEntry } from "@/components/weekrecap/WeekRecapEntry";

// Greeting, then one full-width section per concern stacked top to bottom:
// activity rings, UPCOMING, WORKING ON, workspaces. No side-by-side columns — a section
// owns the full measure so the eye only ever scans in one direction. All
// borderless (no card wrappers, no nested cards).
export default function HomeScreen() {
  const [overview, setOverview] = useState(false);
  if (!overview) return <HomeStage onOpenOverview={() => setOverview(true)} />;
  return <HomeOverview onBack={() => setOverview(false)} />;
}

function HomeOverview({ onBack }: { onBack: () => void }) {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-12 animate-in fade-in slide-in-from-bottom-1 duration-300">
      <button
        type="button"
        onClick={onBack}
        className="-mb-8 flex w-fit items-center gap-2 rounded-full px-3 py-2 -ml-3 text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
      >
        <ArrowLeft size={16} />
        <ThemedText type="caption" className="text-inherit">
          Back to focus
        </ThemedText>
      </button>
      <WelcomeHeader />
      <WeekRecapEntry earlyWeekOnly />

      <section className="flex flex-col gap-4">
        <SectionHeader title="Activity Rings" />
        <TodayHero />
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeader
          title="Upcoming"
          right={
            <Link
              to="/activity"
              className="text-muted-foreground transition-colors hover:text-foreground"
              aria-label="View all"
            >
              <CaretRight size={16} weight="regular" />
            </Link>
          }
        />
        <TodaySection />
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeader title="Working On" />
        <WorkingOnRow />
      </section>

      <PersonalWorkspaces />
    </div>
  );
}
