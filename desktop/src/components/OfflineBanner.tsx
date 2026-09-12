import { CloudOff } from "lucide-react";
import { useConnectivity } from "@/hooks/useConnectivity";
import { useWorkspaces } from "@/hooks/useWorkspaces";

/**
 * Relative age of the cached data, kept deliberately coarse — the point is to
 * reassure the user their data is recent, not to give them a stopwatch.
 */
function describeAge(timestamp: number | undefined): string | null {
  if (!timestamp) return null;
  const minutes = Math.floor((Date.now() - timestamp) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/**
 * Shown whenever we can't reach the backend. The app keeps working from the
 * persisted query cache underneath — this just explains why nothing is updating.
 */
export function OfflineBanner() {
  const { isOffline } = useConnectivity();
  const { dataUpdatedAt } = useWorkspaces();

  if (!isOffline) return null;

  const age = describeAge(dataUpdatedAt);

  return (
    <div className="relative z-20 flex items-center justify-center gap-2 bg-muted px-4 py-1.5 text-xs text-muted-foreground">
      <CloudOff className="size-3.5" />
      <span>{age ? `You're offline — last synced ${age}` : "You're offline"}</span>
    </div>
  );
}
