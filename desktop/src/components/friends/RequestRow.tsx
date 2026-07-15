import type { JSX } from "react";
import { X } from "@phosphor-icons/react";
import PrimaryButton from "@/components/PrimaryButton";
import { Button } from "@/components/ui/button";
import { UserRow } from "@/components/friends/UserRow";
import {
  useAcceptRequest,
  useRemoveConnection,
  type ConnectionDocument,
} from "@/hooks/useConnections";

// All /v1/user/* ops require both auth headers; the client middleware fills the real tokens.
const AUTH = { Authorization: "", refresh_token: "" };

// An incoming request: Accept (primary) or decline (X). On success the hooks
// invalidate the received list, so the row drops out on its own.
export function RequestRow({ request }: { request: ConnectionDocument }): JSX.Element {
  const accept = useAcceptRequest();
  const decline = useRemoveConnection();
  const busy = accept.isPending || decline.isPending;
  const r = request.requester;

  return (
    <UserRow
      userId={r._id}
      displayName={r.name}
      handle={r.handle}
      profilePicture={r.picture}
      className={busy ? "pointer-events-none opacity-50" : undefined}
      action={
        <>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={busy}
            aria-label="Decline"
            onClick={() =>
              decline.mutate({ params: { header: AUTH, path: { id: request.id } } })
            }
          >
            <X weight="bold" />
          </Button>
          <PrimaryButton
            title="Accept"
            className="w-auto px-5 py-2"
            disabled={busy}
            onClick={() =>
              accept.mutate({ params: { header: AUTH, path: { id: request.id } } })
            }
          />
        </>
      }
    />
  );
}

export default RequestRow;
