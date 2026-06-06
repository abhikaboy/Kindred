import { router } from "expo-router";
import NotificationsView from "@/components/notifications/NotificationsView";

// Standalone route kept for deep links / push-notification taps that open
// Notifications directly. The swipe-pager path lives in feed.tsx; this wrapper
// just renders the same view with a router-based back to the feed.
export default function NotificationsRoute() {
    return <NotificationsView isActive onBack={() => router.dismissTo("/(logged-in)/(tabs)/(feed)/feed")} />;
}
