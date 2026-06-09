import React, { useState, useMemo } from "react";
import {
    View,
    TouchableOpacity,
    StyleSheet,
    Dimensions,
    Image as RNImage,
} from "react-native";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { SpeakerHigh, SpeakerSlash } from "phosphor-react-native";
import CachedImage from "../CachedImage";
import { ThemedText } from "../ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import Carousel from "react-native-reanimated-carousel";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { components } from "@/api/generated/types";
import type { MediaItem } from "@/api/media";

type ImageSize = components["schemas"]["ImageSize"];

const SimpleImage = ({
    source,
    style,
    onLongPress,
}: {
    source: any;
    style: any;
    onLongPress?: () => void;
}) => (
    <TouchableOpacity
        onLongPress={onLongPress}
        activeOpacity={1}
        style={{ width: "100%", height: "100%" }}
        delayLongPress={500}
        disabled={!onLongPress}
    >
        <CachedImage
            source={source}
            style={style}
            variant="large"
            useLocalPlaceholder
            cachePolicy="memory-disk"
        />
    </TouchableOpacity>
);

// Instagram-style video: autoplay muted + loop, tap toggles sound, pauses when
// the slide is not the active/visible one.
const VideoSlide = ({
    item,
    width,
    height,
    active,
}: {
    item: MediaItem;
    width: number;
    height: number;
    active: boolean;
}) => {
    const [muted, setMuted] = useState(true);
    const player = useVideoPlayer(item.url, (p) => {
        p.loop = true;
        p.muted = true;
    });

    React.useEffect(() => {
        if (active) {
            player.play();
        } else {
            player.pause();
        }
    }, [active, player]);

    const toggleMute = () => {
        const next = !muted;
        setMuted(next);
        player.muted = next;
    };

    return (
        <View style={{ width, height }}>
            <VideoView
                player={player}
                style={{ width, height, backgroundColor: "#000" }}
                contentFit="cover"
                nativeControls={false}
            />
            <TouchableOpacity onPress={toggleMute} activeOpacity={0.8} style={styles.muteBadge}>
                {muted ? (
                    <SpeakerSlash size={16} color="#fff" weight="fill" />
                ) : (
                    <SpeakerHigh size={16} color="#fff" weight="fill" />
                )}
            </TouchableOpacity>
        </View>
    );
};

const MediaSlide = ({
    item,
    width,
    height,
    active,
    onLongPress,
}: {
    item: MediaItem;
    width: number;
    height: number;
    active: boolean;
    onLongPress?: () => void;
}) => {
    if (item.type === "video") {
        return <VideoSlide item={item} width={width} height={height} active={active} />;
    }
    return (
        <SimpleImage
            source={{ uri: item.url }}
            style={[styles.image, { width, height }]}
            onLongPress={onLongPress}
        />
    );
};

export type PostCardMediaProps = {
    images: string[];
    media?: MediaItem[];
    /** When true, videos pause (e.g. card scrolled off-screen in the feed). */
    videoPaused?: boolean;
    dual?: string | null;
    size?: ImageSize;
    /** Called when the user long-presses an image (opens fullscreen modal in real card) */
    onImageLongPress?: (index: number) => void;
    /** Called when the dual photo is tapped — used in preview to swap main/dual */
    onDualPress?: () => void;
    /** Called when the remove-dual button is pressed — used in preview */
    onDualRemove?: () => void;
    /** Override image height (pixels). When omitted, height is derived from `size` or measured. */
    imageHeight?: number;
    onImageHeightChange?: (height: number) => void;
};

const PostCardMedia = ({
    images,
    media,
    videoPaused = false,
    dual,
    size,
    onImageLongPress,
    onDualPress,
    onDualRemove,
    imageHeight: imageHeightProp,
    onImageHeightChange,
}: PostCardMediaProps) => {
    const ThemedColor = useThemeColor();
    const screenWidth = useMemo(() => Dimensions.get("window").width, []);
    const [containerWidth, setContainerWidth] = useState<number>(screenWidth);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [derivedImageHeight, setDerivedImageHeight] = useState<number | null>(null);

    // Prefer media[]; fall back to images[] for older callers.
    const items: MediaItem[] = useMemo(
        () =>
            media && media.length > 0
                ? media
                : images.map((url) => ({ type: "image", url, width: 0, height: 0 }) as MediaItem),
        [media, images]
    );

    const imageHeight = imageHeightProp ?? derivedImageHeight ?? containerWidth * 0.75;

    const computeHeight = React.useCallback((w: number, imgW: number, imgH: number) => {
        const aspectRatio = imgW / imgH;
        const calculated = w / aspectRatio;
        return Math.max(w * 0.5, Math.min(calculated, w * 1.5));
    }, []);

    // Derive height from size metadata when no override is provided
    React.useEffect(() => {
        if (imageHeightProp !== undefined) return;
        if (items.length === 0) {
            setDerivedImageHeight(containerWidth * 0.75);
            onImageHeightChange?.(containerWidth * 0.75);
            return;
        }
        if (size && size.width > 0 && size.height > 0) {
            const constrained = computeHeight(containerWidth, size.width, size.height);
            setDerivedImageHeight(constrained);
            onImageHeightChange?.(constrained);
        } else if (items[0].width > 0 && items[0].height > 0) {
            const constrained = computeHeight(containerWidth, items[0].width, items[0].height);
            setDerivedImageHeight(constrained);
            onImageHeightChange?.(constrained);
        } else if (items[0].type === "image") {
            RNImage.getSize(
                items[0].url,
                (w, h) => {
                    const constrained = computeHeight(containerWidth, w, h);
                    setDerivedImageHeight(constrained);
                    onImageHeightChange?.(constrained);
                },
                () => {
                    const fallback = containerWidth * 0.75;
                    setDerivedImageHeight(fallback);
                    onImageHeightChange?.(fallback);
                }
            );
        } else {
            const fallback = containerWidth * 0.75;
            setDerivedImageHeight(fallback);
            onImageHeightChange?.(fallback);
        }
    }, [items.map((m) => m.url).join(","), size?.width, size?.height, containerWidth, imageHeightProp]);

    if (items.length === 0) return null;

    const renderDualOverlay = () => {
        if (!dual) return null;
        return (
            <>
                <TouchableOpacity
                    onPress={onDualPress}
                    activeOpacity={onDualPress ? 0.9 : 1}
                    disabled={!onDualPress}
                    style={styles.dualOverlay}
                >
                    <Image
                        source={{ uri: dual }}
                        style={styles.dualImage}
                        contentFit="cover"
                    />
                </TouchableOpacity>
                {onDualRemove && (
                    <TouchableOpacity
                        onPress={onDualRemove}
                        style={styles.dualRemoveButton}
                    >
                        <Ionicons name="close" size={14} color="#fff" />
                    </TouchableOpacity>
                )}
            </>
        );
    };

    return (
        <View
            style={styles.imageContainer}
            onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
        >
            {items.length === 1 ? (
                <View style={{ width: containerWidth, height: imageHeight }}>
                    <MediaSlide
                        item={items[0]}
                        width={containerWidth}
                        height={imageHeight}
                        active={!videoPaused}
                        onLongPress={onImageLongPress ? () => onImageLongPress(0) : undefined}
                    />
                    {renderDualOverlay()}
                </View>
            ) : (
                <View style={styles.carouselContainer}>
                    <Carousel
                        loop={false}
                        vertical={false}
                        width={containerWidth}
                        height={imageHeight}
                        style={[styles.carousel, { width: containerWidth }]}
                        data={items}
                        onSnapToItem={(index) => setCurrentImageIndex(index)}
                        scrollAnimationDuration={300}
                        enabled={items.length > 1}
                        windowSize={2}
                        onConfigurePanGesture={(panGesture) => {
                            panGesture
                                .activeOffsetX([-10, 10])
                                .failOffsetY([-30, 30])
                                .maxPointers(1);
                        }}
                        renderItem={({ item, index }) => (
                            <View style={{ width: containerWidth, height: imageHeight }}>
                                <MediaSlide
                                    item={item}
                                    width={containerWidth}
                                    height={imageHeight}
                                    active={!videoPaused && index === currentImageIndex}
                                    onLongPress={onImageLongPress ? () => onImageLongPress(index) : undefined}
                                />
                                {renderDualOverlay()}
                            </View>
                        )}
                    />

                    <View style={styles.imageCounter}>
                        <View style={styles.imageCounterBackground}>
                            <ThemedText style={styles.imageCounterText}>
                                {currentImageIndex + 1}/{items.length}
                            </ThemedText>
                        </View>
                    </View>

                    <View style={styles.dotIndicators}>
                        {items.map((_, index) => (
                            <View
                                key={index}
                                style={[
                                    styles.dot,
                                    {
                                        backgroundColor:
                                            index === currentImageIndex
                                                ? ThemedColor.primary
                                                : ThemedColor.tertiary,
                                    },
                                ]}
                            />
                        ))}
                    </View>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    imageContainer: {
        width: "100%",
        marginBottom: 18,
    },
    carouselContainer: {
        position: "relative",
    },
    carousel: {
        minWidth: "100%",
    },
    image: {
        width: "100%",
        resizeMode: "cover",
    },
    imageCounter: {
        position: "absolute",
        top: 12,
        right: 12,
        zIndex: 10,
    },
    imageCounterBackground: {
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    imageCounterText: {
        color: "#ffffff",
        fontSize: 12,
        fontWeight: "600",
        textAlign: "center",
    },
    dotIndicators: {
        position: "absolute",
        bottom: 12,
        left: 0,
        right: 0,
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        gap: 6,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        opacity: 0.8,
    },
    dualOverlay: {
        position: "absolute",
        top: 16,
        left: 16,
        width: "30%",
        aspectRatio: 3 / 4,
        borderRadius: 12,
        borderWidth: 3,
        borderColor: "#fff",
        overflow: "hidden",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 5,
    },
    dualImage: {
        width: "100%",
        height: "100%",
    },
    muteBadge: {
        position: "absolute",
        bottom: 12,
        right: 12,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: "rgba(0,0,0,0.6)",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 10,
    },
    dualRemoveButton: {
        position: "absolute",
        top: 6,
        left: 6,
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: "rgba(0,0,0,0.7)",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 11,
    },
});

export default PostCardMedia;
