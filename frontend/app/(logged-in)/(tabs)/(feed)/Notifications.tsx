import React from "react";
import { Redirect } from "expo-router";

// Notifications now lives as a page inside the feed pager (see feed.tsx), not as a
// standalone screen. This route only remains to redirect any stale or restored
// navigation that lands on it (dev nav-state restoration, old links) back to the feed,
// so the Feed tab always opens on the feed.
export default function NotificationsRoute() {
    return <Redirect href="/(logged-in)/(tabs)/(feed)/feed" />;
}
