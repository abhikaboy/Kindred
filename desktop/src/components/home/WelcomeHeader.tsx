import { Link } from "react-router-dom";
import { GearSix } from "@phosphor-icons/react";
import { ThemedText } from "@/components/ThemedText";
import { useAuth } from "@/contexts/auth";

// Time-of-day greeting, ported from mobile WelcomeHeader.
export function WelcomeHeader() {
  const { user } = useAuth();
  const hour = new Date().getHours();
  const greeting =
    hour < 12
      ? "It's Coffee Time,"
      : hour < 18
        ? "Keep that energy going,"
        : "Time to unwind,";
  const emoji = hour < 12 ? "☕" : hour < 18 ? "🌤️" : "🌙";
  const dateLine = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex items-start justify-between">
      <div className="flex flex-col gap-1">
        <ThemedText type="subheading">{greeting}</ThemedText>
        <ThemedText type="titleFraunces" as="h1">
          {user?.display_name ? `${user.display_name}!` : "there!"} {emoji}
        </ThemedText>
        <ThemedText type="caption" className="text-muted-foreground">
          {dateLine}
        </ThemedText>
      </div>
      <Link
        to="/settings"
        aria-label="Settings"
        className="p-1 text-muted-foreground transition-colors hover:text-foreground"
      >
        <GearSix size={22} />
      </Link>
    </div>
  );
}
