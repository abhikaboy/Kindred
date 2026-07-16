import { Link } from "react-router-dom";
import { CaretRight } from "@phosphor-icons/react";
import { WelcomeHeader } from "@/components/home/WelcomeHeader";
import { ProductivityRings } from "@/components/home/ProductivityRings";
import { WorkingOnRow } from "@/components/home/WorkingOnRow";
import { TodaySection } from "@/components/home/TodaySection";
import { PersonalWorkspaces } from "@/components/home/PersonalWorkspaces";
import { SectionHeader } from "@/components/home/SectionHeader";

// Greeting, then TODAY rings beside UPCOMING, a full-width WORKING ON strip, and
// workspaces — all borderless sections (no card wrappers, no nested cards).
export default function HomeScreen() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <WelcomeHeader />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-5">
        <section className="flex flex-col gap-3 lg:col-span-2">
          <SectionHeader title="Today" />
          <div className="flex justify-start">
            <ProductivityRings />
          </div>
        </section>

        <section className="flex flex-col gap-3 lg:col-span-3">
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
      </div>

      <section className="flex flex-col gap-3">
        <SectionHeader title="Working On" />
        <WorkingOnRow />
      </section>

      <PersonalWorkspaces />
    </div>
  );
}
