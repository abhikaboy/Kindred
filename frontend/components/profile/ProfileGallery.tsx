import React, { useEffect, useState, useRef, useCallback } from "react";
import { View, StyleSheet, TouchableOpacity, Animated, Image, Dimensions, useColorScheme, ActivityIndicator } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { deletePost, getAllPosts, getUserPosts } from "@/api/post";
import { router } from "expo-router";
import { useAuth } from "@/hooks/useAuth";
import { showToast } from "@/utils/showToast";
import CachedImage from "../CachedImage";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import CustomAlert, { AlertButton } from "@/components/modals/CustomAlert";

interface ProfileGalleryProps {
    userId?: string;
    images?: string[];
}

interface PostImage {
    imageUrl: string;
    postId: string;
    postUserId: string;
}

// Gallery Skeleton Component
const GallerySkeleton = ({ ThemedColor }: { ThemedColor: any }) => {
    const shimmerAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const shimmerLoop = Animated.loop(
            Animated.sequence([
                Animated.timing(shimmerAnim, {
                    toValue: 1,
                    duration: 1500,
                    useNativeDriver: true,
                }),
                Animated.timing(shimmerAnim, {
                    toValue: 0,
                    duration: 1500,
                    useNativeDriver: true,
                }),
            ])
        );
        shimmerLoop.start();

        // Cleanup: stop animation on unmount
        return () => {
            shimmerLoop.stop();
        };
    }, [shimmerAnim]);

    const opacity = shimmerAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0.3, 0.7],
    });

    // Generate 9 skeleton items (3x3 grid)
    const skeletonItems = Array.from({ length: 9 }, (_, i) => i);

    return (
        <View style={styles.skeletonContainer}>
            {skeletonItems.map((item) => (
                <Animated.View
                    key={`skeleton-${item}`}
                    style={[
                        styles.skeletonItem,
                        {
                            backgroundColor: ThemedColor.tertiary,
                            opacity: Animated.add(opacity, new Animated.Value(Math.random() * 0.2)),
                        },
                    ]}
                />
            ))}
        </View>
    );
};

// Empty State Component
const EmptyGallery = ({ ThemedColor }: { ThemedColor: any }) => {
    const colorScheme = useColorScheme();

    return (
        <View style={styles.emptyContainer}>
            <Image
                source={require("@/assets/images/343.Art-Gallery.png")}
                style={[
                    styles.emptyImage,
                    colorScheme === 'dark' && styles.invertedImage
                ]}
                resizeMode="contain"
            />
            <ThemedText type="subtitle" style={styles.emptyTitle}>
                No Posts Yet
            </ThemedText>
            <ThemedText type="default" style={[styles.emptyDescription, { color: ThemedColor.caption }]}>
                Posts with photos will appear here
            </ThemedText>
        </View>
    );
};

const GALLERY_PAGE_SIZE = 18;

const ProfileGalleryComponent = ({ userId, images }: ProfileGalleryProps) => {
    const { user } = useAuth();
    const ThemedColor = useThemeColor();
    const [postImages, setPostImages] = useState<PostImage[]>([]);
    const [deletingPosts, setDeletingPosts] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [offset, setOffset] = useState(0);

    // Alert state
    const [alertVisible, setAlertVisible] = useState(false);
    const [alertTitle, setAlertTitle] = useState("");
    const [alertMessage, setAlertMessage] = useState("");
    const [alertButtons, setAlertButtons] = useState<AlertButton[]>([]);

    const mapPostsToImages = (posts: any[], fallbackUserId?: string): PostImage[] =>
        posts
            .filter((post) => post.images && post.images.length > 0)
            .sort((a, b) => {
                const dateA = new Date(a.metadata?.createdAt || 0);
                const dateB = new Date(b.metadata?.createdAt || 0);
                return dateB.getTime() - dateA.getTime();
            })
            .map((post) => {
                const postUserId = post.user?._id || fallbackUserId || "";
                return {
                    imageUrl: post.images[0],
                    postId: post._id,
                    postUserId,
                };
            });

    useEffect(() => {
        const fetchImages = async () => {
            setIsLoading(true);
            setOffset(0);
            setHasMore(false);

            if (images && images.length > 0) {
                const legacyImages = images.map((imageUrl, index) => ({
                    imageUrl,
                    postId: `legacy-${index}`,
                    postUserId: "",
                }));
                setPostImages(legacyImages);
                setIsLoading(false);
                return;
            }

            try {
                let response;

                if (userId) {
                    response = await getUserPosts(userId, GALLERY_PAGE_SIZE, 0);
                } else {
                    // Fallback to getAllPosts for backward compatibility
                    response = await getAllPosts(GALLERY_PAGE_SIZE, 0);
                }

                const postImageData = mapPostsToImages(response.posts, userId);
                console.log("ProfileGallery: Total post images loaded:", postImageData.length);
                setPostImages(postImageData);
                setHasMore(response.hasMore);
                setOffset(response.nextOffset);
            } catch (error) {
                console.error("Error fetching post images:", error);
                setPostImages([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchImages();
    }, [userId, images]);

    const handleLoadMore = useCallback(async () => {
        if (!hasMore || isLoadingMore || isLoading) return;

        setIsLoadingMore(true);
        try {
            let response;
            if (userId) {
                response = await getUserPosts(userId, GALLERY_PAGE_SIZE, offset);
            } else {
                response = await getAllPosts(GALLERY_PAGE_SIZE, offset);
            }

            const newImages = mapPostsToImages(response.posts, userId);
            setPostImages((prev) => [...prev, ...newImages]);
            setHasMore(response.hasMore);
            setOffset(response.nextOffset);
        } catch (error) {
            console.error("Error loading more post images:", error);
        } finally {
            setIsLoadingMore(false);
        }
    }, [hasMore, isLoadingMore, isLoading, userId, offset]);

    const handleImagePress = (postId: string) => {
        if (postId.startsWith("legacy-")) {
            return;
        }
        router.push(`/(logged-in)/posting/${postId}`);
    };

    const canDeletePost = (postUserId: string) => {
        if (!user?._id) {
            console.log("ProfileGallery: No user._id found");
            return false;
        }
        const canDelete = user._id === postUserId;
        console.log("ProfileGallery canDeletePost:", {
            userId: user._id,
            postUserId,
            canDelete,
            match: user._id === postUserId,
        });
        return canDelete;
    };

    const showPostOptions = (postId: string, postUserId: string) => {
        if (postId.startsWith("legacy-")) {
            return;
        }

        console.log("ProfileGallery showPostOptions called with:", { postId, postUserId, currentUserId: user?._id });

        const options: AlertButton[] = [];

        options.push({
            text: "View Post",
            onPress: () => handleImagePress(postId),
        });

        if (canDeletePost(postUserId)) {
            console.log("ProfileGallery: Adding Delete Post option");
            options.push({
                text: "Delete Post",
                style: "destructive" as const,
                onPress: () => showDeleteConfirmation(postId),
            });
        } else {
            console.log("ProfileGallery: NOT adding Delete Post option");
        }

        options.push({
            text: "Cancel",
            style: "cancel" as const,
        });

        console.log(
            "ProfileGallery: Showing alert with options:",
            options.map((o) => o.text)
        );

        setAlertTitle("Post Options");
        setAlertMessage("");
        setAlertButtons(options);
        setAlertVisible(true);
    };

    const showDeleteConfirmation = (postId: string) => {
        setAlertTitle("Delete Post");
        setAlertMessage("Are you sure you want to delete this post? This action cannot be undone.");
        setAlertButtons([
            {
                text: "Cancel",
                style: "cancel",
            },
            {
                text: "Delete",
                style: "destructive",
                onPress: () => handleDeletePost(postId),
            },
        ]);
        setAlertVisible(true);
    };

    const handleDeletePost = async (postId: string) => {
        setDeletingPosts((prev) => new Set([...prev, postId]));

        try {
            await deletePost(postId);

            // remove from local state
            setPostImages((prev) => prev.filter((img) => img.postId !== postId));

            showToast("Post deleted successfully", "success");
        } catch (error) {
            console.error("Failed to delete post:", error);

            setDeletingPosts((prev) => {
                const newSet = new Set(prev);
                newSet.delete(postId);
                return newSet;
            });

            showToast("Failed to delete post", "danger");
        }
    };

    const handleImageLongPress = (postId: string, postUserId: string) => {
        showPostOptions(postId, postUserId);
    };

    // Memoize render functions BEFORE any conditional returns
    const renderItem = React.useCallback(({ item }: { item: PostImage }) => {
        const isDeleting = deletingPosts.has(item.postId);

        return (
            <TouchableOpacity
                style={[styles.galleryItem, isDeleting && styles.deletingItem]}
                onPress={() => handleImagePress(item.postId)}
                onLongPress={() => handleImageLongPress(item.postId, item.postUserId)}
                delayLongPress={500}
                activeOpacity={isDeleting ? 1 : 0.8}>
                <CachedImage
                    style={[styles.galleryImage, isDeleting && styles.deletingImage]}
                    source={{
                        uri: item.imageUrl,
                    }}
                    variant="thumbnail"
                    cachePolicy="disk"
                    transition={100}
                />
            </TouchableOpacity>
        );
    }, [deletingPosts, handleImagePress, handleImageLongPress]);

    const renderFooter = useCallback(() => {
        if (!isLoadingMore) return null;
        return (
            <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={ThemedColor.primary} />
            </View>
        );
    }, [isLoadingMore, ThemedColor.primary]);

    // Show skeleton while loading
    if (isLoading) {
        return <GallerySkeleton ThemedColor={ThemedColor} />;
    }

    // Show empty state when no posts
    if (postImages.length === 0) {
        return <EmptyGallery ThemedColor={ThemedColor} />;
    }

    return (
        <>
            <View style={{ minHeight: 2, flex: 1 }}>
                <FlashList
                    numColumns={3}
                    data={postImages}
                    renderItem={renderItem}
                    keyExtractor={(item, index) => `gallery-${item.postId}-${index}`}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.galleryContainer}
                    removeClippedSubviews={true}
                    onEndReached={handleLoadMore}
                    onEndReachedThreshold={0.5}
                    ListFooterComponent={renderFooter}
                    initialNumToRender={12}
                    maxToRenderPerBatch={9}
                    windowSize={5}
                    estimatedItemSize={120}
                />
            </View>
            {alertVisible && (
                <CustomAlert
                    visible={alertVisible}
                    setVisible={setAlertVisible}
                    title={alertTitle}
                    message={alertMessage}
                    buttons={alertButtons}
                />
            )}
        </>
    );
}

const styles = StyleSheet.create({
    galleryItem: {
        flex: 1 / 3,
        aspectRatio: 1,
        margin: 2,
    },
    galleryContainer: {
        padding: 2,
    },
    galleryImage: {
        aspectRatio: 1,
    },
    deletingItem: {
        opacity: 0.5,
    },
    deletingImage: {
        opacity: 0.7,
    },
    // Skeleton styles
    skeletonContainer: {
        flexDirection: "row",
        flexWrap: "wrap",
        padding: 2,
    },
    skeletonItem: {
        width: (Dimensions.get("window").width - 16) / 3,
        aspectRatio: 1,
        margin: 2,
        borderRadius: 4,
    },
    // Footer loader
    footerLoader: {
        paddingVertical: 16,
        alignItems: "center",
    },
    // Empty state styles
    emptyContainer: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 60,
        paddingHorizontal: 40,
    },
    emptyImage: {
        width: 150,
        height: 150,
        marginBottom: 24,
        opacity: 0.8,
    },
    invertedImage: {
        tintColor: '#ffffff',
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: "600",
        marginBottom: 8,
        textAlign: "center",
    },
    emptyDescription: {
        fontSize: 14,
        textAlign: "center",
        lineHeight: 20,
    },
});

// Memoize ProfileGallery to prevent unnecessary re-renders
export default React.memo(ProfileGalleryComponent, (prevProps, nextProps) => {
    return (
        prevProps.userId === nextProps.userId &&
        prevProps.images === nextProps.images
    );
});
