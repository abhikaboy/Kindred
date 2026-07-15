import React from "react";
import { Redirect } from "expo-router";

// The kudos screen is deprecated — kudos (encouragements/congratulations) now live on the
// notifications page inside the feed pager (see feed.tsx). This route only remains to redirect
// stale or restored navigation (old push links, dev nav-state restoration) to that surface.
export default function KudosRoute() {
    return <Redirect href="/(logged-in)/(tabs)/(feed)/feed?page=notifications" />;
}
