import React, { useEffect, useState } from "react";
import { View, StyleSheet, TouchableOpacity, useColorScheme } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { deletePost, getPostsByBlueprint } from "@/api/post";
import { router } from "expo-router";
import { useAuth } from "@/hooks/useAuth";
import { showToast } from "@/utils/showToast";
import { Image } from "expo-image";
import CachedImage from "../CachedImage";
import { ThemedText } from "../ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import LoadingScreen from "../ui/LoadingScreen";
import CustomAlert, { AlertButton } from "@/components/modals/CustomAlert";

interface BlueprintGalleryProps {
    blueprintId: string;
}

interface PostImage {
    imageUrl: string;
    postId: string;
    postUserId: string;
}

export default function BlueprintGallery({ blueprintId }: BlueprintGalleryProps) {
    const { user } = useAuth();
    const ThemedColor = useThemeColor();
    const styles = stylesheet(ThemedColor);

    const [postImages, setPostImages] = useState<PostImage[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [deletingPosts, setDeletingPosts] = useState<Set<string>>(new Set());

    // Alert state
    const [alertVisible, setAlertVisible] = useState(false);
    const [alertTitle, setAlertTitle] = useState("");
    const [alertMessage, setAlertMessage] = useState("");
    const [alertButtons, setAlertButtons] = useState<AlertButton[]>([]);

    useEffect(() => {
        fetchBlueprintImages();
    }, [blueprintId]);

    const fetchBlueprintImages = async () => {
        try {
            setLoading(true);
            setError(null);

            const posts = await getPostsByBlueprint(blueprintId);

            const postImageData: PostImage[] = posts
                .filter((post) => post.images && post.images.length > 0)
                .sort((a, b) => {
                    const dateA = new Date(a.metadata?.createdAt || 0);
                    const dateB = new Date(b.metadata?.createdAt || 0);
                    return dateB.getTime() - dateA.getTime();
                })
                .map((post) => ({
                    imageUrl: post.images[0],
                    postId: post._id,
                    postUserId: post.user._id,
                }));

            setPostImages(postImageData);
        } catch (error) {
            console.error("Error fetching blueprint post images:", error);
            setError("Failed to load blueprint gallery");
            setPostImages([]);
        } finally {
            setLoading(false);
        }
    };

    const handleImagePress = (postId: string) => {
        router.push(`/(logged-in)/posting/${postId}`);
    };

    const canDeletePost = (postUserId: string) => {
        if (!user?._id) return false;
        return user._id === postUserId;
    };

    const showPostOptions = (postId: string, postUserId: string) => {
        const options: AlertButton[] = [];

        options.push({
            text: "View Post",
            onPress: () => handleImagePress(postId),
        });

        if (canDeletePost(postUserId)) {
            options.push({
                text: "Delete Post",
                style: "destructive" as const,
                onPress: () => showDeleteConfirmation(postId),
            });
        }

        options.push({
            text: "Cancel",
            style: "cancel" as const,
        });

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
        try {
            setDeletingPosts((prev) => new Set(prev.add(postId)));

            await deletePost(postId);

            // Remove the deleted post from the local state
            setPostImages((prevImages) => prevImages.filter((image) => image.postId !== postId));

            showToast("Post deleted successfully", "success");
        } catch (error) {
            console.error("Error deleting post:", error);
            showToast("Failed to delete post", "danger");
        } finally {
            setDeletingPosts((prev) => {
                const newSet = new Set(prev);
                newSet.delete(postId);
                return newSet;
            });
        }
    };

    const handleImageLongPress = (postId: string, postUserId: string) => {
        showPostOptions(postId, postUserId);
    };

    // Memoize render function BEFORE any conditional returns
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
    }, [deletingPosts]);

    const renderEmptyState = () => {
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
                    No Posts with Images Yet
                </ThemedText>
            </View>
        );
    };

    const renderErrorState = () => (
        <View style={styles.emptyState}>
            <MaterialIcons name="error-outline" size={32} color={ThemedColor.primary} />
            <ThemedText type="caption" style={styles.errorText}>
                {error}
            </ThemedText>
            <TouchableOpacity onPress={fetchBlueprintImages} style={styles.retryButton}>
                <ThemedText type="caption" style={styles.retryText}>
                    Tap to retry
                </ThemedText>
            </TouchableOpacity>
        </View>
    );

    if (loading) {
        <LoadingScreen message="Getting Blueprints..." />;
    }

    if (error) {
        return renderErrorState();
    }

    if (postImages.length === 0) {
        return renderEmptyState();
    }

    return (
        <>
            <View style={{ minHeight: 2, flex: 1 }}>
                <FlashList
                    numColumns={3}
                    data={postImages}
                    renderItem={renderItem}
                    keyExtractor={(item, index) => `blueprint-gallery-${item.postId}-${index}`}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.galleryContainer}
                    removeClippedSubviews={true}
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

const stylesheet = (ThemedColor: any) =>
    StyleSheet.create({
        galleryItem: {
            flex: 1 / 3,
            aspectRatio: 1,
            margin: 1,
            borderRadius: 8,
            overflow: "hidden",
        },
        galleryImage: {
            width: "100%",
            height: "100%",
        },
        galleryContainer: {
            paddingBottom: 20,
        },
        deletingItem: {
            opacity: 0.5,
        },
        deletingImage: {
            opacity: 0.3,
        },
        emptyState: {
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: 60,
            paddingHorizontal: 20,
        },
        emptyText: {
            marginTop: 16,
            textAlign: "center",
            fontSize: 16,
        },
        emptySubtext: {
            marginTop: 8,
            textAlign: "center",
            fontSize: 14,
            opacity: 0.7,
        },
        errorText: {
            marginTop: 16,
            textAlign: "center",
            color: ThemedColor.destructive,
        },
        retryButton: {
            marginTop: 12,
            padding: 8,
        },
        retryText: {
            color: ThemedColor.primary,
            textDecorationLine: "underline",
        },
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
