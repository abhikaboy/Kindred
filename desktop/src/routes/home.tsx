import { Link } from "react-router-dom";
import { ListChecks, Lightning, CalendarBlank, CaretRight } from "@phosphor-icons/react";
import { WelcomeHeader } from "@/components/home/WelcomeHeader";
import { ProductivityRings } from "@/components/home/ProductivityRings";
import { WorkingOnRow } from "@/components/home/WorkingOnRow";
import { TodaySection } from "@/components/home/TodaySection";
import { PersonalWorkspaces } from "@/components/home/PersonalWorkspaces";
import { BentoTile } from "@/components/home/BentoTile";

// Asymmetric magazine bento: greeting, TODAY/WORKING ON stack beside a tall UPCOMING, then workspaces.
export default function HomeScreen() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <WelcomeHeader />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5 lg:grid-rows-[auto_auto]">
        {/* Left column: TODAY rings + WORKING ON */}
        <div className="flex flex-col gap-6 lg:col-span-2 lg:row-span-2">
          <BentoTile title="TODAY" icon={ListChecks} contentClassName="flex justify-center">
            <ProductivityRings />
          </BentoTile>

          <BentoTile title="WORKING ON" icon={Lightning}>
            <WorkingOnRow />
          </BentoTile>
        </div>

        {/* Right column: tall UPCOMING spanning both left tiles */}
        <BentoTile
          title="UPCOMING"
          icon={CalendarBlank}
          className="lg:col-span-3 lg:row-span-2 lg:self-start"
          action={
            <Link
              to="/activity"
              className="text-muted-foreground transition-colors hover:text-foreground"
              aria-label="View all"
            >
              <CaretRight size={16} weight="regular" />
            </Link>
          }
        >
          <TodaySection />
        </BentoTile>
      </div>

      <PersonalWorkspaces />
    </div>
  );
}
