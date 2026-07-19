import { useState, type JSX } from "react";
import { Link } from "react-router-dom";
import { Trophy, HandsClapping, CheckCircle } from "@phosphor-icons/react";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/ui/button";
import { SendKudosModal } from "@/components/notifications/SendKudosModal";
import { useAuth } from "@/contexts/auth";
import { formatNotificationTime } from "@/lib/notifications";
import type { components } from "@/lib/api/types.gen";

export function RingsClosedFeedCard({
  ringsClosed,
}: {
  ringsClosed: components["schemas"]["FeedRingsClosedData"];
}): JSX.Element {
  const { user } = useAuth();
  const [kudosOpen, setKudosOpen] = useState(false);
  const [sent, setSent] = useState(false);

  const isOwn = user?._id === ringsClosed.user._id;
  const line = ringsClosed.content.trim() || "Closed all their rings 🎉";

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Link to={`/account/${ringsClosed.user._id}`} className="shrink-0">
          <img
            src={ringsClosed.user.profile_picture}
            alt=""
            className="h-10 w-10 rounded-full object-cover"
          />
        </Link>
        <div className="flex flex-col">
          <ThemedText type="defaultSemiBold">{ringsClosed.user.display_name}</ThemedText>
          <ThemedText type="caption">
            @{ringsClosed.user.handle} · {formatNotificationTime(new Date(ringsClosed.timestamp).getTime())}
          </ThemedText>
        </div>
      </div>

      <div className="rounded-xl bg-primary/5 p-3 flex items-center gap-3">
        <Trophy weight="duotone" size={28} className="text-primary shrink-0" />
        <ThemedText type="default" as="p">{line}</ThemedText>
      </div>

      {!isOwn &&
        (sent ? (
          <div className="flex items-center gap-1.5 text-primary">
            <CheckCircle weight="fill" size={18} />
            <ThemedText type="defaultSemiBold" className="text-primary">
              Congrats sent ✓
            </ThemedText>
          </div>
        ) : (
          <div>
            <Button size="sm" variant="outline" onClick={() => setKudosOpen(true)}>
              <HandsClapping weight="fill" />
              Send congrats
            </Button>
          </div>
        ))}

      <SendKudosModal
        open={kudosOpen}
        onClose={() => setKudosOpen(false)}
        kind="congratulation"
        receiverId={ringsClosed.user._id}
        recipientName={ringsClosed.user.display_name}
        showRings
        onSent={() => setSent(true)}
      />
    </div>
  );
}

export default RingsClosedFeedCard;
