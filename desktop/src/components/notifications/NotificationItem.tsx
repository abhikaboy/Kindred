import { useState, type JSX } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, PaperPlaneTilt, HandsClapping, CheckCircle, Play } from "@phosphor-icons/react";
import { ThemedText } from "@/components/ThemedText";
import NotificationCard, {
  ActionCircle,
  ActionPill,
  FooterRow,
  SentenceBold,
  SentenceFocus,
  SentenceText,
} from "@/components/notifications/NotificationCard";
import ReactionTray, { KUDOS_HEART_EMOJI } from "@/components/notifications/ReactionTray";
import SendKudosModal from "@/components/notifications/SendKudosModal";
import { useKudos, useReactToEncouragement, useReactToCongratulation } from "@/hooks/useKudos";
import { formatNotificationTime, type ProcessedNotification } from "@/lib/notifications";

// Backend sends comment content pre-composed ('<name> commented: "text"') — keep only the body.
function extractCommentBody(raw: string): string {
  const match = raw.match(/commented:\s*"?([\s\S]*?)"?\s*$/i);
  return (match ? match[1] : raw).trim();
}

// Session-local set of rings-closed notifications the user has congratulated (mirrors mobile;
// the backend doesn't track which were congratulated, so this survives remounts within a session).
const sentCongratsIds = new Set<string>();

// Kudos cards (encouragement + congratulation): reaction tray + "Send kudos back", optional media.
function EncouragementCard({ n }: { n: ProcessedNotification }): JSX.Element {
  const navigate = useNavigate();
  const kind = n.type === "congratulation" ? "congratulation" : "encouragement";
  const isCongrats = kind === "congratulation";
  const { matchKudos } = useKudos();
  const encReact = useReactToEncouragement();
  const conReact = useReactToCongratulation();
  const [trayOpen, setTrayOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);

  const matched = matchKudos(kind, n.userId, n.kudosMessage, n.time);
  const react = isCongrats ? conReact.react : encReact.react;

  // A media kudos arrives as its URL in kudosMessage; thumbnail present ⇒ video.
  const mediaUrl = n.kudosMessage?.trim();
  const isMediaUrl = !!mediaUrl && /^https?:\/\//i.test(mediaUrl);
  const isVideo = isMediaUrl && !!n.thumbnail;
  const isImage = isMediaUrl && !n.thumbnail;
  const textMessage = n.kudosMessage && !isMediaUrl ? n.kudosMessage : undefined;

  const isProfileScope = !n.referenceId && !n.taskName;
  const showTask = !isProfileScope && !!n.taskName;

  const sentence = (
    <SentenceText>
      <SentenceBold>{n.name}</SentenceBold>
      {isCongrats ? " congratulated you" : " sent you encouragement"}
      {showTask ? (isCongrats ? " on " : " for ") : ""}
      {showTask ? <SentenceBold>{n.taskName}</SentenceBold> : null}
      {textMessage ? ": " : ""}
      {textMessage ? <SentenceFocus>{`"${textMessage}"`}</SentenceFocus> : null}
    </SentenceText>
  );

  const media =
    isImage ? (
      <img src={mediaUrl} alt="" className="aspect-[16/10] w-full rounded-2xl object-cover" />
    ) : isVideo ? (
      <button
        type="button"
        onClick={() => setVideoOpen(true)}
        className="relative block w-full overflow-hidden rounded-2xl"
      >
        <img src={n.thumbnail} alt="" className="aspect-[16/10] w-full object-cover" />
        <span className="absolute inset-0 flex items-center justify-center">
          <Play size={40} weight="fill" className="text-white drop-shadow" />
        </span>
      </button>
    ) : undefined;

  const footer = (
    <FooterRow>
      {matched ? (
        <div className="relative inline-flex">
          <ActionCircle label="React to kudos" onClick={() => setTrayOpen(true)}>
            {matched.reaction === KUDOS_HEART_EMOJI ? (
              <Heart size={20} weight="fill" className="text-destructive" />
            ) : matched.reaction ? (
              <span className="text-lg">{matched.reaction}</span>
            ) : (
              <Heart size={20} className="text-foreground" />
            )}
          </ActionCircle>
          <ReactionTray
            open={trayOpen}
            currentReaction={matched.reaction}
            onSelect={(emoji) => react(matched.id, emoji)}
            onClose={() => setTrayOpen(false)}
          />
        </div>
      ) : null}
      <ActionPill
        label={`Send kudos back to ${n.name}`}
        caption="Send kudos back"
        onClick={() => setModalOpen(true)}
      >
        <PaperPlaneTilt size={20} className="text-foreground" />
      </ActionPill>
    </FooterRow>
  );

  // Task-scope encouragements deep-link to the task; congratulations/profile kudos have no desktop route.
  const onClick =
    !isCongrats && n.referenceId ? () => navigate(`/task/${n.referenceId}`) : undefined;

  return (
    <>
      <NotificationCard
        timeLabel={formatNotificationTime(n.time)}
        icon={n.icon}
        sentence={sentence}
        media={media}
        footer={footer}
        onClick={onClick}
      />
      <SendKudosModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        recipientName={n.name}
        receiverId={n.userId}
        kind="encouragement"
      />
      {videoOpen && isVideo ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setVideoOpen(false)}
        >
          <video
            src={mediaUrl}
            controls
            autoPlay
            className="max-h-[80vh] w-full max-w-2xl rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}
    </>
  );
}

// Rings-closed: "Send congrats" → flips to "Congrats sent" once sent.
function RingsClosedCard({ n }: { n: ProcessedNotification }): JSX.Element {
  const [modalOpen, setModalOpen] = useState(false);
  const [sent, setSent] = useState(sentCongratsIds.has(n.id));

  const sentence = (
    <SentenceText>
      <SentenceBold>{n.name}</SentenceBold>
      {" closed all their rings 🎉"}
    </SentenceText>
  );

  const footer = sent ? (
    <div className="flex items-center gap-1.5">
      <CheckCircle size={16} weight="fill" className="text-primary" />
      <ThemedText type="defaultSemiBold" className="text-[13px] text-primary">
        Congrats sent
      </ThemedText>
    </div>
  ) : (
    <FooterRow>
      <ActionPill
        label={`Send congrats to ${n.name}`}
        caption="Send congrats"
        onClick={() => setModalOpen(true)}
      >
        <HandsClapping size={20} className="text-foreground" />
      </ActionPill>
    </FooterRow>
  );

  return (
    <>
      <NotificationCard
        timeLabel={formatNotificationTime(n.time)}
        icon={n.icon}
        sentence={sentence}
        footer={footer}
      />
      <SendKudosModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        recipientName={n.name}
        receiverId={n.userId}
        kind="congratulation"
        onSent={() => {
          sentCongratsIds.add(n.id);
          setSent(true);
        }}
      />
    </>
  );
}

// Dispatches a processed notification to its card. Kudos/rings types own their state in
// dedicated components; the rest are plain sentence cards.
export function NotificationItem({ notification: n }: { notification: ProcessedNotification }): JSX.Element | null {
  const navigate = useNavigate();
  const timeLabel = formatNotificationTime(n.time);

  switch (n.type) {
    case "encouragement":
    case "congratulation":
      return <EncouragementCard n={n} />;
    case "rings_closed":
      return <RingsClosedCard n={n} />;
    case "comment": {
      const body = n.content ? extractCommentBody(n.content) : "";
      return (
        <NotificationCard
          timeLabel={timeLabel}
          icon={n.icon}
          sentence={
            <SentenceText>
              <SentenceBold>{n.name}</SentenceBold>
              {" commented on your post"}
              {body ? ": " : ""}
              {body ? <SentenceFocus>{`"${body}"`}</SentenceFocus> : null}
            </SentenceText>
          }
        />
      );
    }
    case "kudos_reaction": {
      const tail = n.content?.startsWith("reacted") ? n.content : "reacted to your kudos";
      return (
        <NotificationCard
          timeLabel={timeLabel}
          icon={n.icon}
          sentence={
            <SentenceText>
              <SentenceBold>{n.name}</SentenceBold>
              {` ${tail}`}
            </SentenceText>
          }
          onClick={() => navigate(`/account/${n.userId}`)}
        />
      );
    }
    case "friend_request_accepted":
      return (
        <NotificationCard
          timeLabel={timeLabel}
          icon={n.icon}
          sentence={
            <SentenceText>
              <SentenceBold>{n.name}</SentenceBold>
              {" accepted your friend request"}
            </SentenceText>
          }
          onClick={() => navigate(`/account/${n.userId}`)}
        />
      );
    case "post_tag":
      return (
        <NotificationCard
          timeLabel={timeLabel}
          icon={n.icon}
          sentence={
            <SentenceText>
              <SentenceBold>{n.name}</SentenceBold>
              {" tagged you in a post"}
            </SentenceText>
          }
        />
      );
    case "task_tagged":
      return (
        <NotificationCard
          timeLabel={timeLabel}
          icon={n.icon}
          sentence={
            <SentenceText>
              <SentenceBold>{n.name}</SentenceBold>
              {" tagged you in a task"}
            </SentenceText>
          }
          onClick={() => navigate("/")}
        />
      );
    case "task_copied": {
      const taskName = n.content.match(/"([^"]+)"/)?.[1];
      return (
        <NotificationCard
          timeLabel={timeLabel}
          icon={n.icon}
          sentence={
            <SentenceText>
              <SentenceBold>{n.name}</SentenceBold>
              {" added "}
              {taskName ? <SentenceBold>{taskName}</SentenceBold> : null}
              {taskName ? " from your blueprint 💪" : "a task from your blueprint 💪"}
            </SentenceText>
          }
          onClick={n.referenceId ? () => navigate(`/task/${n.referenceId}`) : undefined}
        />
      );
    }
    default:
      return null;
  }
}

export default NotificationItem;
