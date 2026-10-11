import React, { useState } from "react";
import { View } from "react-native";
import PostCardMedia from "@/components/cards/PostCardMedia";

type Props = {
    uris: string[];
    mediaTypesByUri: Record<string, "image" | "video">;
    dual?: string | null;
    onDualPress?: () => void;
    onDualRemove?: () => void;
    /** Taller media is cropped to this height */
    maxHeight?: number;
};

// Post media in the camera's rounded box, clipped to the media's own height
const StageMedia = ({ uris, mediaTypesByUri, dual, onDualPress, onDualRemove, maxHeight }: Props) => {
    const [height, setHeight] = useState<number | null>(null);
    const capped = height !== null && maxHeight !== undefined && height > maxHeight;
    const boxHeight = height === null ? undefined : capped ? maxHeight : height;

    return (
        <View style={{ height: boxHeight, borderRadius: 24, overflow: "hidden", backgroundColor: "#111" }}>
            <PostCardMedia
                images={uris}
                media={uris.map((uri) => ({
                    type: mediaTypesByUri[uri] ?? "image",
                    url: uri,
                    thumbnailUrl: uri,
                    width: 0,
                    height: 0,
                }))}
                dual={dual}
                onDualPress={onDualPress}
                onDualRemove={onDualRemove}
                imageHeight={capped ? maxHeight : undefined}
                onImageHeightChange={setHeight}
            />
        </View>
    );
};

export default StageMedia;
