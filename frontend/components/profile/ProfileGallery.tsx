import React, { useEffect, useState } from "react";
import { View, StyleSheet, FlatList, TouchableOpacity, Alert } from "react-native";
import { deletePost, getAllPosts, getUserPosts } from "@/api/post";
import { router } from "expo-router";
import { useAuth } from "@/hooks/useAuth";
import { showToast } from "@/utils/showToast";
import { Image } from "expo-image";
import CachedImage from "../CachedImage";

interface ProfileGalleryProps {
    userId?: string;
    images?: string[];
}

interface PostImage {
    imageUrl: string;
    postId: string;
    postUserId: string;
}

export default function ProfileGallery({ userId, images }: ProfileGalleryProps) {
    const { user } = useAuth();
    const [postImages, setPostImages] = useState<PostImage[]>([]);
    const [deletingPosts, setDeletingPosts] = useState<Set<string>>(new Set());
    
    useEffect(() => {
        const fetchImages = async () => {
            if (images && images.length > 0) {
                const legacyImages = images.map((imageUrl, index) => ({
                    imageUrl,
                    postId: `legacy-${index}`,
                    postUserId: "",
                }));
                setPostImages(legacyImages);
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
                    .map((post) => ({
                        imageUrl: post.images[0],
                        postId: post._id,
                        postUserId: post.user._id,
                    }));

                setPostImages(postImageData);
            } catch (error) {
                console.error("Error fetching post images:", error);
                setPostImages([]);
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
        if (!user?._id) return false;
        return user._id === postUserId;
    };

    const showPostOptions = (postId: string, postUserId: string) => {
        if (postId.startsWith("legacy-")) {
            return;
        }

        const options = [];

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

        Alert.alert("Post Options", "", options);
    };

    const showDeleteConfirmation = (postId: string) => {
        Alert.alert(
            "Delete Post", 
            "Are you sure you want to delete this post? This action cannot be undone.", 
            [
                {
                    text: "Cancel",
                    style: "cancel",
                },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: () => handleDeletePost(postId),
                },
            ]
        );
    };

    const handleDeletePost = async (postId: string) => {
        setDeletingPosts(prev => new Set([...prev, postId]));

        try {
            await deletePost(postId);
            
            // remove from local state
            setPostImages(prev => prev.filter(img => img.postId !== postId));
            
            showToast("Post deleted successfully", "success");
        } catch (error) {
            console.error("Failed to delete post:", error);
            
            setDeletingPosts(prev => {
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
});