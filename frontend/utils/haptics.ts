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

export const hapticSelect = () => {
    if (ios) Haptics.selectionAsync().catch(() => {});
};

export const hapticSuccess = () => {
    if (ios) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
};
