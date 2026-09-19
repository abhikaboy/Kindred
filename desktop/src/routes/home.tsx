import { Link } from "react-router-dom";
import { CaretRight } from "@phosphor-icons/react";
import { WelcomeHeader } from "@/components/home/WelcomeHeader";
import { TodayHero } from "@/components/home/TodayHero";
import { WorkingOnRow } from "@/components/home/WorkingOnRow";
import { TodaySection } from "@/components/home/TodaySection";
import { PersonalWorkspaces } from "@/components/home/PersonalWorkspaces";
import { SectionHeader } from "@/components/home/SectionHeader";

// Greeting, then one full-width section per concern stacked top to bottom:
// TODAY, UPCOMING, WORKING ON, workspaces. No side-by-side columns — a section
// owns the full measure so the eye only ever scans in one direction. All
// borderless (no card wrappers, no nested cards).
export default function HomeScreen() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-12">
      <WelcomeHeader />

      <section className="flex flex-col gap-4">
        <SectionHeader title="Today" />
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
