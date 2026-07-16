import { useState, type JSX } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, Plus, User } from "@phosphor-icons/react";
import { ThemedText } from "@/components/ThemedText";
import { useSendRequest, type UserExtendedReference } from "@/hooks/useConnections";

// All /v1/user/* ops require both auth headers; the client middleware fills the real tokens.
const AUTH = { Authorization: "", refresh_token: "" };

// Mobile-style suggested card: the profile photo fills the card, a dark gradient
// anchors the handle + name at the bottom, and the whole card links to the profile.
// The Add action surfaces on hover so the request flow isn't lost on desktop.
export function SuggestedCard({ user }: { user: UserExtendedReference }): JSX.Element {
  const send = useSendRequest();
  const [requested, setRequested] = useState(false);

  return (
    <div className="group/card relative aspect-[125/160] w-36 shrink-0 overflow-hidden rounded-xl border">
      <Link to={`/account/${user._id}`} className="absolute inset-0 block">
        {user.profile_picture ? (
          <img src={user.profile_picture} alt="" className="size-full object-cover" />
        ) : (
          <div className="grid size-full place-items-center bg-muted">
            <User size={28} weight="light" className="text-muted-foreground" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/70" />
        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-0.5 p-3">
          <ThemedText type="caption" className="block truncate text-white/70">
            {user.handle}
          </ThemedText>
          <div className="flex items-center justify-between gap-1">
            <ThemedText type="defaultSemiBold" className="truncate text-white">
              {user.display_name}
            </ThemedText>
            <ArrowRight size={16} weight="bold" className="shrink-0 text-white" />
          </div>
        </div>
      </Link>

      {requested ? (
        <span className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-primary text-primary-foreground shadow">
          <Check size={16} weight="bold" />
        </span>
      ) : (
        <button
          type="button"
          aria-label={`Add ${user.display_name}`}
          disabled={send.isPending}
          onClick={() =>
            send.mutate(
              { params: { header: AUTH }, body: { receiver_id: user._id } },
              { onSuccess: () => setRequested(true) }
            )
          }
          className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-white/90 text-black opacity-0 shadow transition-opacity hover:bg-white group-hover/card:opacity-100 disabled:opacity-50"
        >
          <Plus size={16} weight="bold" />
        </button>
      )}
    </div>
  );
}

export default SuggestedCard;
