import React, { useEffect, useState } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useThemeColor } from "@/hooks/useThemeColor";
import { ThemedText } from "@/components/ThemedText";
import PostCard from "@/components/cards/PostCard";
import { PostCardSkeleton } from "@/components/ui/SkeletonLoader";
import { getPostById } from "@/api/post";
import { Ionicons } from "@expo/vector-icons";
import { showToast } from "@/utils/showToast";
import { useNavigation } from "expo-router";

export default function PostDetail() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const ThemedColor = useThemeColor();
    const styles = stylesheet(ThemedColor);
    const navigation = useNavigation();

    const [post, setPost] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const handleBack = () => {
        if (navigation.canGoBack()) {
            router.back();
        } else {
            // No navigation stack, go to feed
            router.replace("/(logged-in)/(tabs)/(feed)/" as any);
        }
    };

    useEffect(() => {
        const fetchPost = async () => {
            if (!id) {
                setError("No post ID provided");
                setLoading(false);
                return;
            }

            setLoading(true);
            setError(null);

            try {
                const postData = await getPostById(id);
                console.log(postData);
                const user = postData.user;

                const processedPost = {
                    ...postData,
                    user: {
                        _id: user._id,
                        display_name: user.display_name,
                        handle: user.handle,
                        profile_picture: user.profile_picture,
                    },
                };
                setPost(processedPost);
            } catch (error) {
                setError("Failed to load post");
            } finally {
                setLoading(false);
            }
        };

        fetchPost();
    }, [id]);

    const refreshPost = async () => {
        if (!id) return;

        try {
            const postData = await getPostById(id);
            console.log(postData);
            const user = postData.user;

            const processedPost = {
                ...postData,
                user: {
                    _id: user._id,
                    display_name: user.display_name,
                    handle: user.handle,
                    profile_picture: user.profile_picture,
                },
            };
            setPost(processedPost);
        } catch (error) {
            console.error("Failed to refresh post:", error);
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={handleBack} style={styles.backButton} activeOpacity={0.7}>
                        <Ionicons name="arrow-back" size={24} color={ThemedColor.text} />
                    </TouchableOpacity>
                    <ThemedText style={[styles.headerTitle, { color: ThemedColor.text }]}>Post</ThemedText>
                    <View style={{ width: 24 }} />
                </View>

                <ScrollView
                    style={styles.scrollContainer}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContent}>
                    <PostCardSkeleton />
                </ScrollView>
            </SafeAreaView>
        );
    }

    if (error || !post) {
        return (
            <SafeAreaView style={[styles.container, styles.centerContent]}>
                <Ionicons name="alert-circle-outline" size={50} color={ThemedColor.error} />
                <ThemedText style={[styles.errorText, { color: ThemedColor.error }]}>
                    {error || "Post not found"}
                </ThemedText>
                <TouchableOpacity
                    style={[styles.retryButton, { backgroundColor: ThemedColor.primary }]}
                    onPress={handleBack}>
                    <ThemedText style={styles.retryButtonText}>Go Back</ThemedText>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={handleBack} style={styles.backButton} activeOpacity={0.7}>
                    <Ionicons name="arrow-back" size={24} color={ThemedColor.text} />
                </TouchableOpacity>
                <ThemedText style={[styles.headerTitle, { color: ThemedColor.text }]}>Post</ThemedText>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView
                style={styles.scrollContainer}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}>
                <PostCard
                    icon={post.user.profile_picture}
                    name={post.user.display_name}
                    username={post.user.handle}
                    userId={post.user._id}
                    caption={post.caption}
                    time={
                        post.metadata?.createdAt
                            ? Math.abs(new Date().getTime() - new Date(post.metadata.createdAt).getTime()) / 36e5
                            : 0
                    }
                    priority="low"
                    points={0}
                    timeTaken={0}
                    category={post.task?.category?.name}
                    taskName={post.task?.content}
                    reactions={
                        post.reactions && typeof post.reactions === "object"
                            ? Object.entries(post.reactions).map(([emoji, userIds]) => ({
                                  emoji,
                                  count: Array.isArray(userIds) ? userIds.length : 0,
                                  ids: Array.isArray(userIds) ? userIds : [],
                              }))
                            : []
                    }
                    comments={post.comments || []}
                    images={post.images || []}
                    size={post.size}
                    onReactionUpdate={refreshPost}
                    id={post._id}
                />
            </ScrollView>
        </SafeAreaView>
    );
}

const stylesheet = (ThemedColor: any) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: ThemedColor.background,
        },
        centerContent: {
            justifyContent: "center",
            alignItems: "center",
            gap: 16,
        },
        header: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: ThemedColor.tertiary,
        },
        backButton: {
            padding: 4,
        },
        headerTitle: {
            fontSize: 18,
            fontWeight: "600",
        },
        scrollContainer: {
            flex: 1,
        },
        scrollContent: {
            paddingBottom: 20,
        },
        errorText: {
            fontSize: 18,
            textAlign: "center",
            marginBottom: 16,
        },
        retryButton: {
            paddingHorizontal: 20,
            paddingVertical: 10,
            borderRadius: 8,
        },
        retryButtonText: {
            color: "#ffffff",
            fontSize: 16,
            fontWeight: "600",
        },
    });
