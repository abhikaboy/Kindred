import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowBendUpLeft } from "@phosphor-icons/react";
import { ThemedText } from "@/components/ThemedText";
import { SectionHeader } from "@/components/home/SectionHeader";
import { SendKudosModal } from "@/components/notifications/SendKudosModal";
import { useKudos } from "@/hooks/useKudos";

type Recent = { id: string; kind: "encouragement" | "congratulation"; senderId: string; name: string; picture: string; message: string; time: number };

const ago = (ms: number) => {
  const mins = Math.round((Date.now() - ms) / 60_000);
  if (mins < 60) return `${Math.max(1, mins)}m`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)}h`;
  return `${Math.round(mins / (60 * 24))}d`;
};

/** Latest kudos received, each one a tap away from sending one back. */
export function ProfileKudos() {
  const { encouragements, congratulations, isLoading } = useKudos();
  const [replyTo, setReplyTo] = useState<Recent | null>(null);

  const recent: Recent[] = [
    ...encouragements.map((k) => ({ ...k, kind: "encouragement" as const })),
    ...congratulations.map((k) => ({ ...k, kind: "congratulation" as const })),
  ]
    .map((k) => ({
      id: k.id,
      kind: k.kind,
      senderId: k.sender.id,
      name: k.sender.name,
      picture: k.sender.picture,
      message: k.message,
      time: new Date(k.timestamp).getTime(),
    }))
    .sort((a, b) => b.time - a.time)
    .slice(0, 4);

  if (isLoading || recent.length === 0) return null;
  const total = encouragements.length + congratulations.length;

  return (
    <section className="flex flex-col gap-3">
      <SectionHeader title={`Kudos · ${total}`} />
      <div className="flex flex-col">
        {recent.map((k) => (
          <div key={k.id} className="group -mx-2 flex items-start gap-3 rounded-xl px-2 py-3 transition-colors duration-150 hover:bg-muted/50">
            <Link to={`/account/${k.senderId}`} className="shrink-0">
              <img src={k.picture} alt="" className="size-9 rounded-full bg-muted object-cover" />
            </Link>
            <div className="flex min-w-0 flex-1 flex-col">
              <ThemedText type="caption">
                <Link to={`/account/${k.senderId}`} className="text-foreground hover:underline">
                  {k.name}
                </Link>{" "}
                {k.kind === "congratulation" ? "congratulated you" : "cheered you on"} · {ago(k.time)}
              </ThemedText>
              {k.message && (
                <ThemedText type="default" className="line-clamp-2">
                  {k.message}
                </ThemedText>
              )}
            </div>
            <button
              type="button"
              onClick={() => setReplyTo(k)}
              aria-label={`Send ${k.name} kudos back`}
              title="Send one back"
              className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground opacity-0 transition-[opacity,background-color,color] duration-150 hover:bg-primary/10 hover:text-primary focus-visible:opacity-100 group-hover:opacity-100"
            >
              <ArrowBendUpLeft size={16} />
            </button>
          </div>
        ))}
      </div>
      {replyTo && (
        <SendKudosModal
          open
          onClose={() => setReplyTo(null)}
          recipientName={replyTo.name}
          receiverId={replyTo.senderId}
          kind="encouragement"
          scope="profile"
        />
      )}
    </section>
  );
}
