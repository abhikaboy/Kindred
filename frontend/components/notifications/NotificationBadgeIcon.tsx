import React from "react";
import {
    At,
    ChatCircle,
    Confetti,
    Copy,
    HandsClapping,
    Heart,
    Tag,
    Target,
    UserPlus,
    type IconProps,
    type IconWeight,
} from "phosphor-react-native";
import type { ProcessedNotification } from "@/utils/notifications";

type NotificationType = ProcessedNotification["type"];

// The colored glyph that sits on the avatar's corner disc (see SpeechBubbleCard).
// Colors are theme-independent on purpose — the white/dark disc behind them adapts.
const BADGES: Partial<
    Record<NotificationType, { Icon: React.ComponentType<IconProps>; color: string; weight: IconWeight }>
> = {
    congratulation: { Icon: Confetti, color: "#22C55E", weight: "fill" },
    encouragement: { Icon: HandsClapping, color: "#854DFF", weight: "fill" },
    kudos_reaction: { Icon: Heart, color: "#FF5C5F", weight: "fill" },
    comment: { Icon: ChatCircle, color: "#3B82F6", weight: "fill" },
    post_tag: { Icon: At, color: "#3B82F6", weight: "bold" },
    task_tagged: { Icon: Tag, color: "#EC4899", weight: "fill" },
    task_copied: { Icon: Copy, color: "#854DFF", weight: "fill" },
    friend_request_accepted: { Icon: UserPlus, color: "#14B8A6", weight: "fill" },
    rings_closed: { Icon: Target, color: "#F59E0B", weight: "fill" },
};

const NotificationBadgeIcon = ({ type }: { type: NotificationType }) => {
    const badge = BADGES[type];
    if (!badge) return null;
    const { Icon, color, weight } = badge;
    return <Icon size={13} color={color} weight={weight} />;
};

export default NotificationBadgeIcon;
