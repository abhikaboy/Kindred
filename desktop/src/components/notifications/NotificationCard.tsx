import type { JSX } from "react";
import { ThemedText } from "@/components/ThemedText";
import { cn } from "@/lib/utils";

// Sentence spans share 18/26 hero sizing; the size lives here so all spans align inline.
const SENTENCE_SIZE = "text-[18px] leading-[26px]";

// Muted sentence span — the base sentence tone.
export function SentenceText({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <ThemedText type="default" className={cn(SENTENCE_SIZE, "text-muted-foreground", className)}>
      {children}
    </ThemedText>
  );
}

// Bold span for names and task titles.
export function SentenceBold({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <ThemedText type="defaultSemiBold" className={cn(SENTENCE_SIZE, "text-foreground", className)}>
      {children}
    </ThemedText>
  );
}

// Regular-weight span in the primary text color — quoted comment/kudos bodies.
export function SentenceFocus({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <ThemedText type="default" className={cn(SENTENCE_SIZE, "text-foreground", className)}>
      {children}
    </ThemedText>
  );
}

// 44px round action button — border + background reads as a shape against the card fill.
export function ActionCircle({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="inline-flex h-11 w-11 items-center justify-center rounded-full border bg-background transition-colors hover:bg-muted"
    >
      {children}
    </button>
  );
}

// Round pill action: leading icon + caption label.
export function ActionPill({
  label,
  caption,
  onClick,
  children,
}: {
  label: string;
  caption: string;
  onClick: () => void;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="inline-flex h-11 items-center gap-2 rounded-full border bg-background px-4 transition-colors hover:bg-muted"
    >
      {children}
      <ThemedText type="caption" className="text-foreground">
        {caption}
      </ThemedText>
    </button>
  );
}

// Row container for the card's footer actions.
export function FooterRow({ children }: { children: React.ReactNode }): JSX.Element {
  return <div className="flex items-center gap-2">{children}</div>;
}

type NotificationCardProps = {
  timeLabel: string;
  icon: string;
  sentence: React.ReactNode;
  media?: React.ReactNode;
  footer?: React.ReactNode;
  onClick?: () => void;
};

export function NotificationCard({
  timeLabel,
  icon,
  sentence,
  media,
  footer,
  onClick,
}: NotificationCardProps): JSX.Element {
  const content = (
    <>
      <ThemedText type="caption">{timeLabel}</ThemedText>
      <div className="text-[18px] leading-[26px]">
        <img
          src={icon}
          alt=""
          className="mr-1.5 inline-block h-[22px] w-[22px] rounded-full object-cover align-[-0.3em]"
        />
        {sentence}
      </div>
      {media}
      {/* Footer stops propagation so its buttons don't trigger the card's navigation. */}
      {footer ? <div onClick={(e) => e.stopPropagation()}>{footer}</div> : null}
    </>
  );

  const cardClass =
    "flex flex-col gap-2.5 rounded-2xl border bg-card p-4 shadow-sm text-left";

  if (onClick) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onClick();
        }}
        className={cn(cardClass, "cursor-pointer transition-colors hover:bg-muted/40")}
      >
        {content}
      </div>
    );
  }

  return <div className={cardClass}>{content}</div>;
}

export default NotificationCard;
