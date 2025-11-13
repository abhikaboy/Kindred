import React, { useEffect, useState, useRef } from "react";
import { View, StyleSheet, FlatList, TouchableOpacity, Alert, Animated, Image, Dimensions } from "react-native";
import { deletePost, getAllPosts, getUserPosts } from "@/api/post";
import { router } from "expo-router";
import { useAuth } from "@/hooks/useAuth";
import { showToast } from "@/utils/showToast";
import CachedImage from "../CachedImage";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";

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
        Animated.loop(
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
        ).start();
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
    return (
        <View style={styles.emptyContainer}>
            <Image
                source={require("@/assets/images/343.Art-Gallery.png")}
                style={styles.emptyImage}
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

export default function ProfileGallery({ userId, images }: ProfileGalleryProps) {
    const { user } = useAuth();
    const ThemedColor = useThemeColor();
    const [postImages, setPostImages] = useState<PostImage[]>([]);
    const [deletingPosts, setDeletingPosts] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchImages = async () => {
            setIsLoading(true);

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
                let posts;

                // If userId is provided, fetch all posts for that user without pagination
                // Otherwise, fetch all posts (this case is for backward compatibility)
                if (userId) {
                    posts = await getUserPosts(userId);
                } else {
                    // Fallback to getAllPosts with a large limit for backward compatibility
                    const response = await getAllPosts(10000, 0);
                    posts = response.posts;
                }

                const postImageData: PostImage[] = posts
                    .filter((post) => {
                        return post.images && post.images.length > 0;
                    })
                    .sort((a, b) => {
                        const dateA = new Date(a.metadata?.createdAt || 0);
                        const dateB = new Date(b.metadata?.createdAt || 0);
                        return dateB.getTime() - dateA.getTime();
                    })
                    .map((post) => {
                        const postUserId = post.user?._id || userId || "";
                        console.log("ProfileGallery: Mapping post", {
                            postId: post._id,
                            hasUser: !!post.user,
                            postUserIdFromPost: post.user?._id,
                            userIdProp: userId,
                            finalPostUserId: postUserId,
                        });
                        return {
                            imageUrl: post.images[0],
                            postId: post._id,
                            // Use post.user._id if available, otherwise fall back to userId prop
                            // This handles cases where the API doesn't populate the user field
                            postUserId: postUserId,
                        };
                    });

                console.log("ProfileGallery: Total post images:", postImageData.length);
                setPostImages(postImageData);
            } catch (error) {
                console.error("Error fetching post images:", error);
                setPostImages([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchImages();
    }, [userId, images]);

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

        const options = [];

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
        Alert.alert("Post Options", "", options);
    };

    const showDeleteConfirmation = (postId: string) => {
        Alert.alert("Delete Post", "Are you sure you want to delete this post? This action cannot be undone.", [
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

    // Show skeleton while loading
    if (isLoading) {
        return <GallerySkeleton ThemedColor={ThemedColor} />;
    }

    // Show empty state when no posts
    if (postImages.length === 0) {
        return <EmptyGallery ThemedColor={ThemedColor} />;
    }

    return (
        <FlatList
            numColumns={3}
            data={postImages}
            renderItem={({ item }) => {
                const isDeleting = deletingPosts.has(item.postId);
                const canDelete = canDeletePost(item.postUserId);

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
            }}
            keyExtractor={(item, index) => `gallery-${item.postId}-${index}`}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.galleryContainer}
        />
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
