import React, { useEffect, useState } from "react";
import { View, Image, StyleSheet, FlatList, TouchableOpacity } from "react-native";
import { getAllPosts } from "@/api/post";
import { router } from "expo-router";

interface ProfileGalleryProps {
    userId?: string;
    images?: string[]; // Keep for backward compatibility
}

interface PostImage {
    imageUrl: string;
    postId: string;
}

export default function ProfileGallery({ userId, images }: ProfileGalleryProps) {
    const [postImages, setPostImages] = useState<PostImage[]>([]);

    useEffect(() => {
        const fetchImages = async () => {
            if (images && images.length > 0) {
                const legacyImages = images.map((imageUrl, index) => ({
                    imageUrl,
                    postId: `legacy-${index}`,
                }));
                setPostImages(legacyImages);
                return;
            }

            try {
                const posts = await getAllPosts();

                const postImageData: PostImage[] = posts
                    .filter((post) => {
                        return !userId || post.user._id === userId;
                    })
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

    return (
        <FlatList
            numColumns={3}
            data={postImages}
            renderItem={({ item }) => (
                <TouchableOpacity 
                    style={styles.galleryItem}
                    onPress={() => handleImagePress(item.postId)}
                    activeOpacity={0.8}
                >
                    <Image
                        style={styles.galleryImage}
                        source={{
                            uri: item.imageUrl,
                            cache: "reload",
                        }}
                    />
                </TouchableOpacity>
            )}
            keyExtractor={(item, index) => `gallery-${item.postId}-${index}`} // ✅ Better key
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
});
