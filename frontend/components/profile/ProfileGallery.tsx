import React, { useEffect, useState } from "react";
import { View, Image, StyleSheet, FlatList } from "react-native";
import { getAllPosts } from "@/api/post";

interface ProfileGalleryProps {
    userId?: string;
    images?: string[]; // Keep for backward compatibility
}

export default function ProfileGallery({ userId, images }: ProfileGalleryProps) {
    const [postImages, setPostImages] = useState<string[]>([]);

    useEffect(() => {
        const fetchImages = async () => {
            if (images && images.length > 0) {
                setPostImages(images);
                return;
            }

            try {
                const posts = await getAllPosts();
                
                const allImageUrls: string[] = [];
                
                posts.forEach(post => {
                    if (post.images && post.images.length > 0) {
                        if (!userId || post.user._id === userId) {
                            allImageUrls.push(...post.images);
                        }
                    }
                });

                setPostImages(allImageUrls);
            } catch (error) {
                console.error("Error fetching post images:", error);
                setPostImages([]);
            }
        };

        fetchImages();
    }, [userId, images]);

    return (
        <FlatList
            numColumns={3}
            data={postImages}
            renderItem={({ item }) => (
                <View style={styles.galleryItem}>
                    <Image
                        style={styles.galleryImage}
                        source={{
                            uri: item,
                            cache: "reload",
                        }}
                    />
                </View>
            )}
            keyExtractor={(item, index) => index.toString()}
        />
    );
}

const styles = StyleSheet.create({
    galleryItem: {
        flex: 1 / 3,
        aspectRatio: 1,
        margin: 2,
    },
    galleryImage: {
        aspectRatio: 1,
    },
});