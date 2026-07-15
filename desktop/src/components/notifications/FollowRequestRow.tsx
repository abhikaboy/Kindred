import type { JSX } from "react";
import { Button } from "@/components/ui/button";
import { ThemedText } from "@/components/ThemedText";
import { cn } from "@/lib/utils";
import {
  useAcceptConnection,
  useDenyConnection,
  type ConnectionDocument,
} from "@/hooks/useNotifications";

// Types require both auth headers; the client middleware fills the real tokens.
const AUTH = { Authorization: "", refresh_token: "" };

// A pending follow request with Deny / Accept. On success the hooks invalidate the
// received list, so the row drops out on its own.
export function FollowRequestRow({ request }: { request: ConnectionDocument }): JSX.Element {
  const accept = useAcceptConnection();
  const deny = useDenyConnection();
  const busy = accept.isPending || deny.isPending;
  const r = request.requester;

  const run = (m: typeof accept | typeof deny) =>
    m.mutate({ params: { header: AUTH, path: { id: request.id } } });

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3",
        busy && "pointer-events-none opacity-50"
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <img src={r.picture} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
        <div className="min-w-0">
          <ThemedText type="defaultSemiBold" className="block truncate">
            {r.name}
          </ThemedText>
          <ThemedText type="caption" className="block truncate">
            {r.handle}
          </ThemedText>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button variant="ghost" size="sm" disabled={busy} onClick={() => run(deny)}>
          Deny
        </Button>
        <Button size="sm" disabled={busy} onClick={() => run(accept)}>
          Accept
        </Button>
      </div>
    </div>
  );
}

export default FollowRequestRow;
