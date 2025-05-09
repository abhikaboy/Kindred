import React from "react";
import { View, Image, StyleSheet, FlatList } from "react-native";

interface ProfileGalleryProps {
    images: string[];
}

export default function ProfileGallery({ images }: ProfileGalleryProps) {
    return (
        <FlatList
            numColumns={3}
            data={images}
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
