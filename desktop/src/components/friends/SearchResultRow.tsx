import type { JSX } from "react";
import { Check } from "@phosphor-icons/react";
import PrimaryButton from "@/components/PrimaryButton";
import { ThemedText } from "@/components/ThemedText";
import { UserRow } from "@/components/friends/UserRow";
import {
  useSendRequest,
  useAcceptRequest,
  useRemoveConnection,
  type ProfileDocument,
} from "@/hooks/useConnections";

// All /v1/user/* ops require both auth headers; the client middleware fills the real tokens.
const AUTH = { Authorization: "", refresh_token: "" };

// Search result with a relationship-aware action (Add / Requested / Friends / Accept).
export function SearchResultRow({ profile }: { profile: ProfileDocument }): JSX.Element {
  const send = useSendRequest();
  const accept = useAcceptRequest();
  const remove = useRemoveConnection();
  const busy = send.isPending || accept.isPending || remove.isPending;

  const status = profile.relationship?.status ?? "none";
  const requestId = profile.relationship?.request_id;

  return (
    <UserRow
      userId={profile.id}
      displayName={profile.display_name}
      handle={profile.handle}
      profilePicture={profile.profile_picture}
      className={busy ? "pointer-events-none opacity-50" : undefined}
      action={<Action />}
    />
  );

  function Action(): JSX.Element | null {
    if (status === "self") return null;

    if (status === "connected") {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-xl bg-primary/15 px-4 py-2 text-primary">
          <Check size={16} weight="bold" />
          <ThemedText type="defaultSemiBold" className="text-primary">
            Friends
          </ThemedText>
        </span>
      );
    }

    if (status === "requested") {
      return (
        <PrimaryButton
          title="Requested"
          secondary
          className="w-auto px-5 py-2"
          disabled={busy || !requestId}
          onClick={() =>
            requestId &&
            remove.mutate({ params: { header: AUTH, path: { id: requestId } } })
          }
        />
      );
    }

    if (status === "received") {
      return (
        <PrimaryButton
          title="Accept"
          className="w-auto px-5 py-2"
          disabled={busy || !requestId}
          onClick={() =>
            requestId &&
            accept.mutate({ params: { header: AUTH, path: { id: requestId } } })
          }
        />
      );
    }

    return (
      <PrimaryButton
        title="Add"
        className="w-auto px-5 py-2"
        disabled={busy}
        onClick={() =>
          send.mutate({
            params: { header: AUTH },
            body: { receiver_id: profile.id },
          })
        }
      />
    );
  }
}

export default SearchResultRow;
