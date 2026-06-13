// Constants for kudos rewards system
export const KUDOS_CONSTANTS = {
  ENCOURAGEMENTS_MAX: 12,
  CONGRATULATIONS_MAX: 12,
} as const;

// Curated reaction set — must match backend types.KudosReactionEmojis byte-for-byte
export const KUDOS_REACTION_EMOJIS = ["❤️", "🙌", "🔥", "😭"] as const;
export type KudosReactionEmoji = (typeof KUDOS_REACTION_EMOJIS)[number];

// The heart reaction is rendered as a filled Heart icon, not the emoji glyph.
export const KUDOS_HEART_EMOJI: KudosReactionEmoji = "❤️";
