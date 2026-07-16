import { useState, type JSX } from "react";
import { ChatCircle, Plus } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemedText } from "@/components/ThemedText";
import { EmojiPicker } from "@/components/feed/EmojiPicker";
import { PeopleViewer, type Person } from "@/components/feed/PeopleViewer";
import { KudosViewer } from "@/components/kudos/KudosViewer";
import { useUsersByIds } from "@/hooks/usePostActions";
import type { ReactionGroup } from "@/lib/feed";
import type { components } from "@/lib/api/types.gen";

type PostKudos = components["schemas"]["PostKudos"];

type ReactionRowProps = {
  postId: string;
  groups: ReactionGroup[];
  onToggle: (emoji: string) => void;
  kudos: PostKudos[];
  commentCount: number;
  commentsOpen: boolean;
  onToggleComments: () => void;
  canSendKudos: boolean;
  onSendKudos: () => void;
};

export function ReactionRow({
  groups,
  onToggle,
  kudos,
  commentCount,
  commentsOpen,
  onToggleComments,
  canSendKudos,
  onSendKudos,
}: ReactionRowProps): JSX.Element {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [kudosViewer, setKudosViewer] = useState(false);
  const [reactionViewer, setReactionViewer] = useState<
    { label?: string; people: Person[] }[] | null
  >(null);
  const { fetchUsers } = useUsersByIds();

  const openReactionViewer = async () => {
    // Resolve every reactor once, then bucket per emoji into viewer groups.
    const allIds = Array.from(new Set(groups.flatMap((g) => g.ids)));
    const users = await fetchUsers(allIds);
    const byId = new Map(users.map((u) => [u._id, u]));
    const viewerGroups = groups.map((g) => ({
      label: g.emoji,
      people: g.ids
        .map((id) => byId.get(id))
        .filter((u): u is NonNullable<typeof u> => !!u)
        .map<Person>((u) => ({
          id: u._id,
          name: u.display_name,
          handle: u.handle,
          icon: u.profile_picture,
        })),
    }));
    setReactionViewer(viewerGroups);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {groups.map((group) => (
        <span key={group.emoji} className="inline-flex items-center gap-1">
          <button
            type="button"
            title={`${group.count} reacted ${group.emoji}`}
            onClick={() => onToggle(group.emoji)}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 h-7 text-sm transition-colors cursor-pointer",
              group.mine
                ? "bg-primary/10 border-transparent text-primary"
                : "hover:bg-muted"
            )}
          >
            <span>{group.emoji}</span>
            <span>{group.count}</span>
          </button>
          <button
            type="button"
            aria-label={`View who reacted ${group.emoji}`}
            onClick={openReactionViewer}
            className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
          >
            ·
          </button>
        </span>
      ))}

      <span className="relative inline-flex">
        <button
          type="button"
          aria-label="Add reaction"
          onClick={() => setPickerOpen((o) => !o)}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full border transition-colors hover:bg-muted cursor-pointer"
        >
          <Plus size={14} />
        </button>
        <EmojiPicker
          open={pickerOpen}
          onSelect={(emoji) => onToggle(emoji)}
          onClose={() => setPickerOpen(false)}
        />
      </span>

      {kudos.length > 0 ? (
        <button
          type="button"
          aria-label="View kudos"
          onClick={() => setKudosViewer(true)}
          className="ml-1 inline-flex items-center cursor-pointer"
        >
          {kudos.slice(0, 3).map((k, i) => (
            <img
              key={k.congratulationId}
              src={k.sender.icon}
              alt={k.sender.name}
              className={cn(
                "h-6 w-6 rounded-full border border-card object-cover bg-muted",
                i > 0 && "-ml-2"
              )}
            />
          ))}
        </button>
      ) : null}

      {canSendKudos ? (
        <Button variant="ghost" size="sm" onClick={onSendKudos}>
          Send kudos
        </Button>
      ) : null}

      <Button
        variant="ghost"
        size="sm"
        onClick={onToggleComments}
        aria-expanded={commentsOpen}
        className="ml-auto"
      >
        <ChatCircle size={14} />
        <ThemedText type="smallerDefault" as="span">
          {commentCount > 0 ? `${commentCount} comments` : "Comment"}
        </ThemedText>
      </Button>

      <KudosViewer open={kudosViewer} onClose={() => setKudosViewer(false)} kudos={kudos} />
      <PeopleViewer
        open={reactionViewer !== null}
        onClose={() => setReactionViewer(null)}
        title="Reactions"
        groups={reactionViewer ?? []}
      />
    </div>
  );
}

export default ReactionRow;
