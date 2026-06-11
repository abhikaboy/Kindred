import React from "react";
import { useVideoPlayer, VideoView } from "expo-video";

/** Muted looping preview of a selected video kudos inside the send modal. */
export default function KudosVideoPreview({ uri }: { uri: string }) {
    const player = useVideoPlayer(uri, (p) => {
        p.loop = true;
        p.muted = true;
        p.play();
    });

    return <VideoView player={player} style={{ width: "100%", height: "100%" }} contentFit="cover" nativeControls={false} />;
}
