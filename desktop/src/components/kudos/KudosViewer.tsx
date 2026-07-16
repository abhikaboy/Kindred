import type { JSX } from "react";
import { ThemedText } from "@/components/ThemedText";
import { KudosBubble } from "@/components/kudos/KudosBubble";
import type { components } from "@/lib/api/types.gen";

type PostKudos = components["schemas"]["PostKudos"];

// Shows the actual kudos — sender + the message/image they sent — not just who reacted.
export function KudosViewer({
  open,
  onClose,
  kudos,
}: {
  open: boolean;
  onClose: () => void;
  kudos: PostKudos[];
}): JSX.Element | null {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[70vh] w-full max-w-sm overflow-y-auto rounded-2xl border bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <ThemedText type="subtitle" as="h2">
          Kudos
        </ThemedText>
        <div className="mt-4 flex flex-col gap-4">
          {kudos.length === 0 ? (
            <ThemedText type="caption" as="p">
              No one yet
            </ThemedText>
          ) : (
            kudos.map((k) => (
              <KudosBubble
                key={k.congratulationId}
                name={k.sender.name}
                icon={k.sender.icon}
                message={k.message}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default KudosViewer;
