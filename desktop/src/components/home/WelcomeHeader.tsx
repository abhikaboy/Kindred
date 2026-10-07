import { Link } from "react-router-dom";
import { GearSix } from "@phosphor-icons/react";
import { ThemedText } from "@/components/ThemedText";
import { useAuth } from "@/contexts/auth";

// Time-of-day greeting; mirrors mobile WelcomeHeader.
export function WelcomeHeader() {
  const { user } = useAuth();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const dateLine = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex items-end justify-between animate-in fade-in duration-300">
      <div className="flex flex-col gap-1">
        <ThemedText type="caption" className="text-muted-foreground">
          {dateLine}
        </ThemedText>
        <ThemedText type="titleFraunces" as="h1">
          {greeting}, {user?.display_name || "there"}
        </ThemedText>
      </div>
      <Link
        to="/settings"
        aria-label="Settings"
        className="grid size-9 place-items-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground active:scale-[0.97]"
      >
        <GearSix size={20} />
      </Link>
    </div>
  );
}
