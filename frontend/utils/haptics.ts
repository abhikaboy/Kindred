import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

// Fire-and-forget haptics, iOS-only (matches app convention; Android buzz is harsh).
const ios = Platform.OS === "ios";

export const hapticLight = () => {
    if (ios) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
};

export const hapticMedium = () => {
    if (ios) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
};

export const hapticHeavy = () => {
    if (ios) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
};

export const hapticSelect = () => {
    if (ios) Haptics.selectionAsync().catch(() => {});
};

export const hapticSuccess = () => {
    if (ios) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
};

// Task-completion payoff: thud → sharp snap → success da-dum.
// Steps spaced ≥80ms apart or iOS coalesces them into one buzz.
export const hapticCompletionBurst = () => {
    if (!ios) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid).catch(() => {}), 80);
    setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}), 170);
};
