import React, { useRef, useState, useEffect } from "react";
import { useLocalSearchParams, router } from "expo-router";
import { FlatList } from "react-native-gesture-handler";
import { View, Image, Dimensions, Alert, TouchableOpacity } from "react-native";
import { ThemedView } from "@/components/ThemedView";
import LongTextInput from "@/components/inputs/LongTextInput";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { createPostToBackend } from "@/api/post";
import { uploadImageSmart, ImageUploadResult } from "@/api/upload";
import { ObjectId } from "bson";
import { useAuth } from "@/hooks/useAuth";
import { useSelectedGroup } from "@/contexts/SelectedGroupContext";

export default function Caption() {
    const params = useLocalSearchParams();
    const photos = params.photos ? JSON.parse(params.photos as string) : [];
    const flatListRef = useRef<FlatList>(null);
    const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
    const [data, setData] = useState({ caption: "" });
    const [isPosting, setIsPosting] = useState(false);
    const taskInfo = params.taskInfo ? JSON.parse(params.taskInfo as string) : null;

    const ThemedColor = useThemeColor();
    const { updateUser } = useAuth();
    const { selectedGroupId, selectedGroupName, getGroupIds } = useSelectedGroup();
    
    // Compute display text based on state
    const groupDisplayText = selectedGroupId === null ? "All Friends" : (selectedGroupName || "Selected Group");
    
    // Use theme-appropriate placeholder
    const isDark = ThemedColor.background === '#000000' || ThemedColor.background === '#1a1a1a';
    const placeholderImage = isDark 
        ? require('@/assets/images/placeholder dark.jpg')
        : require('@/assets/images/placeholder light.jpg');
    
    const displayItems = photos.length > 0 ? photos : [placeholderImage];
    const hasActualPhotos = photos.length > 0;
    const handleCaptionChange = (text: string) => {
        setData({
            ...data,
            caption: text,
        });
    };

    const uploadPhotos = async (photoUris: string[]): Promise<{ urls: string[]; sizeInfo?: { width: number; height: number; bytes: number } }> => {
        if (!hasActualPhotos) {
            return { urls: [] };
        }
        const uploadedUrls = [];
        let sizeInfo: { width: number; height: number; bytes: number } | undefined;
        
        for (let i = 0; i < photoUris.length; i++) {
            try {
                const result = await uploadImageSmart(
                    "post",
                    taskInfo?.id || new ObjectId().toString(),
                    photoUris[i],
                    { variant: "large", returnFullResult: true }
                ) as ImageUploadResult;
                
                uploadedUrls.push(result.public_url);
                
                // Use the size info from the first image (primary image)
                if (i === 0) {
                    sizeInfo = {
                        width: result.width,
                        height: result.height,
                        bytes: result.size
                    };
                }
            } catch (error) {
                console.error(`Failed to upload photo ${i + 1}:`, error);
                throw new Error(`Failed to upload photo ${i + 1}. Please try again.`);
            }
        }
        return { urls: uploadedUrls, sizeInfo };
    };
    const handlePost = async () => {
        if (!data.caption.trim()) {
            Alert.alert("Error", "Please add a caption");
            return;
        }

        setIsPosting(true);

        try {
            const uploadResult = await uploadPhotos(hasActualPhotos ? photos : []);
            const taskReference = taskInfo
                ? {
                      id: taskInfo.id,
                      content: taskInfo.name,
                      category: {
                          id: taskInfo.category,
                          name: taskInfo.categoryName || "Unknown Category",
                      },
                  }
                : undefined;

            const selectedGroups = getGroupIds();
            
            const result = await createPostToBackend(
                uploadResult.urls, 
                data.caption, 
                taskReference, 
                undefined, 
                taskInfo?.public ?? false,
                uploadResult.sizeInfo,
                selectedGroups
            );

            // Update user stats locally if available
            if (result.userStats) {
                updateUser({
                    posts_made: result.userStats.posts_made,
                    points: result.userStats.points
                });
            }

            Alert.alert("Success!", "Your post has been shared!", [
                {
                    text: "View Post",
                    onPress: () => {
                        router.dismissAll();
                        router.push(`/(logged-in)/posting/${result.post._id}`);
                    },
                },
                {
                    text: "OK",
                    onPress: () => {
                        router.dismissAll();
                    },
                },
            ]);
        } catch (error) {
            console.error("Error creating post:", error);

            let errorMessage = "Failed to create post. Please try again.";
            if (error instanceof Error) {
                errorMessage = error.message;
            }

            Alert.alert("Error", errorMessage, [{ text: "OK" }]);
        } finally {
            setIsPosting(false);
        }
    };

    return (
        <ThemedView style={{ flex: 1 }}>
            <FlatList
                ref={flatListRef}
                data={displayItems}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(event) => {
                    const index = Math.round(event.nativeEvent.contentOffset.x / Dimensions.get("window").width);
                    setCurrentPhotoIndex(index);
                }}
                renderItem={({ item }) => (
                    <View
                        style={{
                            width: Dimensions.get("window").width,
                        }}>
                        <Image
                            source={{ uri: item || Icons.coffee }}
                            style={{
                                width: "100%",
                                height: "100%",
                                position: "absolute",
                                top: 0,
                                left: 0,
                            }}
                            resizeMode="cover"
                        />
                    </View>
                )}
                keyExtractor={(item, index) => index.toString()}
            />
            <View
                style={{
                    width: "100%",
                    padding: 24,
                    borderRadius: 20,
                    borderTopLeftRadius: 20,
                    borderTopRightRadius: 20,
                    backgroundColor: ThemedColor.background,
                }}>
                <LongTextInput
                    placeholder="Enter a caption"
                    value={data.caption}
                    setValue={handleCaptionChange}
                    fontSize={16}
                    minHeight={300}
                />
                <View
                    style={{
                        gap: 8,
                    }}>
                    <View
                        style={{
                            width: "100%",
                            padding: 20,
                            justifyContent: "space-between",
                            backgroundColor: ThemedColor.lightened,
                            borderRadius: 8,
                            flexDirection: "row",
                        }}>
                        <ThemedText>Points Gained</ThemedText>
                        <ThemedText>{taskInfo?.points || 1} points</ThemedText>
                    </View>
                    <TouchableOpacity
                        style={{
                            width: "100%",
                            padding: 20,
                            justifyContent: "space-between",
                            backgroundColor: ThemedColor.lightened,
                            borderRadius: 8,
                            flexDirection: "row",
                        }}
                        onPress={() => {
                            router.push("/(logged-in)/posting/groups");
                        }}
                        activeOpacity={0.7}>
                        <ThemedText>Who can see this post?</ThemedText>
                        <ThemedText>{groupDisplayText}</ThemedText>
                    </TouchableOpacity>
                    <PrimaryButton
                        title={isPosting ? "Posting..." : "Post"}
                        onPress={handlePost}
                        disabled={isPosting}
                    />
                </View>
            </View>
        </ThemedView>
    );
}
