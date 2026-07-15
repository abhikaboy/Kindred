import { useState, type JSX } from "react";
import { Check } from "@phosphor-icons/react";
import PrimaryButton from "@/components/PrimaryButton";
import { ThemedText } from "@/components/ThemedText";
import { UserRow } from "@/components/friends/UserRow";
import { useSendRequest, type UserExtendedReference } from "@/hooks/useConnections";

// All /v1/user/* ops require both auth headers; the client middleware fills the real tokens.
const AUTH = { Authorization: "", refresh_token: "" };

// A suggested user with a plain Add action; flips to "Requested" once sent.
export function SuggestedRow({ user }: { user: UserExtendedReference }): JSX.Element {
  const send = useSendRequest();
  const [requested, setRequested] = useState(false);

  return (
    <UserRow
      userId={user._id}
      displayName={user.display_name}
      handle={user.handle}
      profilePicture={user.profile_picture}
      className={send.isPending ? "pointer-events-none opacity-50" : undefined}
      action={
        requested ? (
          <span className="inline-flex items-center gap-1.5 rounded-xl bg-primary/15 px-4 py-2 text-primary">
            <Check size={16} weight="bold" />
            <ThemedText type="defaultSemiBold" className="text-primary">
              Requested
            </ThemedText>
          </span>
        ) : (
          <PrimaryButton
            title="Add"
            className="w-auto px-5 py-2"
            disabled={send.isPending}
            onClick={() =>
              send.mutate(
                { params: { header: AUTH }, body: { receiver_id: user._id } },
                { onSuccess: () => setRequested(true) }
              )
            }
          />
        )
      }
    />
  );
}

export default SuggestedRow;
