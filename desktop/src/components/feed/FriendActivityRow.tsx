import { useState, type JSX } from "react";
import { Link } from "react-router-dom";
import { NotePencil, CircleDashed, HeartStraight, Sparkle } from "@phosphor-icons/react";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/ui/button";
import { SendKudosModal } from "@/components/notifications/SendKudosModal";
import { useFriendReco } from "@/hooks/useFriendReco";
import { cn } from "@/lib/utils";
import type { components } from "@/lib/api/types.gen";

type FriendReference = components["schemas"]["FriendReference"];

const RECO_ICON = {
  task: NotePencil,
  ring: CircleDashed,
  profile: HeartStraight,
} as const;

export function FriendActivityRow({ friend }: { friend: FriendReference }): JSX.Element {
  const { reco, isLoading } = useFriendReco(friend._id);
  const [modalOpen, setModalOpen] = useState(false);
  const RecoIcon = RECO_ICON[reco.kind];

  return (
    <div className="flex items-center gap-2.5 py-2">
      <Link
        to={`/account/${friend._id}`}
        className="flex min-w-0 flex-1 items-center gap-2.5 transition-opacity hover:opacity-80"
      >
        <img
          src={friend.profile_picture}
          alt={friend.display_name}
          className="h-9 w-9 rounded-full object-cover bg-muted shrink-0"
        />
        <div className="flex-1 min-w-0">
          <ThemedText type="defaultSemiBold" className="text-sm truncate">
            {friend.display_name}
          </ThemedText>
          <div className="flex items-center gap-1">
            <RecoIcon size={13} weight="duotone" className="text-primary shrink-0" />
            <ThemedText type="caption" className={cn("truncate", isLoading && "opacity-50")}>
              {isLoading ? "…" : reco.label}
            </ThemedText>
          </div>
        </div>
      </Link>
      {!isLoading ? (
        <Button
          size="sm"
          variant="ghost"
          aria-label={`Encourage ${friend.display_name}`}
          onClick={() => setModalOpen(true)}
          className="cursor-pointer"
        >
          <Sparkle weight="duotone" />
        </Button>
      ) : null}
      <SendKudosModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        recipientName={friend.display_name}
        receiverId={friend._id}
        kind="encouragement"
        {...(reco.kind === "task"
          ? {
              scope: "task" as const,
              taskId: reco.task.id,
              taskName: reco.task.content,
              categoryName: "Encouragement",
            }
          : { scope: "profile" as const })}
      />
    </div>
  );
}
