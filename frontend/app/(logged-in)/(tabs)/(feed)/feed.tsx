import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import PostCard from "@/components/cards/PostCard";
import { Icons } from "@/constants/Icons";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import React, { useState, useRef, useCallback, useEffect } from "react";
import { useThemeColor } from "@/hooks/useThemeColor";
import {
    StyleSheet,
    View,
    Dimensions,
    TouchableOpacity,
    ScrollView,
    Image,
    Animated,
    RefreshControl,
    FlatList,
} from "react-native";
import { getAllPosts } from "@/api/post";
import { showToast } from "@/utils/showToast";
import NotificationBadge from "@/components/NotificationBadge";

const HORIZONTAL_PADDING = 16;

type PostData = {
    _id: string;
    user: {
        _id: string;
        display_name: string;
        handle: string;
        profile_picture: string;
    };
    images: string[];
    caption: string;
    task?: {
        id: string;
        content: string;
        category: {
            id: string;
            name: string;
        };
    };
    reactions: { [emoji: string]: string[] } | {};
    comments: any[] | null;
    metadata: {
        createdAt: string;
        updatedAt: string;
        isPublic: boolean;
        isDeleted: boolean;
        isEdited: boolean;
    };
};

export default function Feed() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const ThemedColor = useThemeColor();
    const styles = stylesheet(ThemedColor, insets);
    const [showAnimatedHeader, setShowAnimatedHeader] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [posts, setPosts] = useState<PostData[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
    const [postHeights, setPostHeights] = useState<{[key: string]: number}>({});

    // Feed switching state
    const [currentFeed, setCurrentFeed] = useState<{ name: string; id: string }>({
        name: "All Posts",
        id: "all",
    });
    const [availableFeeds, setAvailableFeeds] = useState([{ name: "All Posts", id: "all" }]);
    const scrollY = useRef(new Animated.Value(0)).current;
    const headerOpacity = useRef(new Animated.Value(0)).current;
    const headerTranslateY = useRef(new Animated.Value(-100)).current;
    const loadingRotation = useRef(new Animated.Value(0)).current;
    const lastScrollY = useRef(0);
    const scrollVelocity = useRef(0);
    const lastScrollTime = useRef(Date.now());
    const velocityThreshold = 0.3;
    const scrollViewRef = useRef<ScrollView>(null);

    // Base post height (without images) - adjust based on your PostCard layout
    const BASE_POST_HEIGHT = 200; // Header + caption + reactions + padding
    const HEADER_HEIGHT = 120; // Header component height

    const updatePostInFeed = useCallback((postId: string, updatedPost: Partial<PostData>) => {
        setPosts((prevPosts) => prevPosts.map((post) => (post._id === postId ? { ...post, ...updatedPost } : post)));
    }, []);

    const refreshSinglePost = useCallback(
        async (postId: string) => {
            try {
                const { getPostById } = await import("@/api/post");
                const updatedPost = await getPostById(postId);
                updatePostInFeed(postId, updatedPost);
            } catch (error) {
                console.error("Failed to refresh post:", error);
            }
        },
        [updatePostInFeed]
    );

    // Handle post height changes
    const handlePostHeightChange = useCallback((postId: string, imageHeight: number) => {
        setPostHeights(prev => ({
            ...prev,
            [postId]: imageHeight
        }));
    }, []);

    // Start loading animation when loading state changes
    useEffect(() => {
        if (loading) {
            Animated.loop(
                Animated.timing(loadingRotation, {
                    toValue: 1,
                    duration: 1000,
                    useNativeDriver: true,
                })
            ).start();
        } else {
            loadingRotation.setValue(0);
        }
    }, [loading, loadingRotation]);

    const fetchPosts = useCallback(async (feedId?: string) => {
        setLoading(true);
        setError(null);
        try {
            const fetchedPosts = await getAllPosts();
            if (!fetchedPosts) {
                throw new Error("No data received from API");
            }
            if (!Array.isArray(fetchedPosts)) {
                throw new Error("API response is not an array");
            }

            setPosts(fetchedPosts);
            setLastUpdated(new Date());
            console.log(`Successfully fetched ${fetchedPosts.length} posts`);

            // Debug: Log the structure of the first post
            if (fetchedPosts.length > 0) {
                console.log("Sample post structure:", JSON.stringify(fetchedPosts[0], null, 2));
            }
        } catch (error) {
            console.error("Error fetching posts:", error);
            const errorMessage = error.message || "Failed to load posts";
            setError(errorMessage);
            showToast("Failed to load posts", "danger");
            setPosts([]);
        } finally {
            setLoading(false);
        }
    }, []);

    const sortedPosts = posts.sort((a, b) => {
        const dateA = new Date(a.metadata?.createdAt || 0);
        const dateB = new Date(b.metadata?.createdAt || 0);
        return dateB.getTime() - dateA.getTime(); 
    });

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            await fetchPosts(currentFeed.id);
            showToast("Feed refreshed successfully", "success");
        } catch (error) {
            console.error("Error refreshing feed:", error);
            showToast("Failed to refresh feed", "danger");
        } finally {
            setRefreshing(false);
        }
    }, [fetchPosts, currentFeed.id]);

    // Load posts on component mount and when feed changes
    useEffect(() => {
        fetchPosts(currentFeed.id);
    }, [currentFeed.id, fetchPosts]);

    const handleFeedChange = useCallback((feed: { name: string; id: string }) => {
        setCurrentFeed(feed);
    }, []);

    const animateHeader = useCallback(
        (show: boolean) => {
            Animated.parallel([
                Animated.timing(headerOpacity, {
                    toValue: show ? 1 : 0,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.timing(headerTranslateY, {
                    toValue: show ? 0 : -100,
                    duration: 300,
                    useNativeDriver: true,
                }),
            ]).start();
        },
        [headerOpacity, headerTranslateY]
    );



    const handleScroll = useCallback(
        (event: any) => {
            const currentScrollY = event.nativeEvent.contentOffset.y;
            const currentTime = Date.now();
            const timeDiff = currentTime - lastScrollTime.current;

            if (timeDiff > 0) {
                scrollVelocity.current = (currentScrollY - lastScrollY.current) / timeDiff;
            }

            const isScrollingUp = scrollVelocity.current < -velocityThreshold && currentScrollY > 100;
            const isScrollingDown = scrollVelocity.current > velocityThreshold;
            const shouldHideHeader = currentScrollY < 50;

            if (isScrollingUp && !showAnimatedHeader) {
                setShowAnimatedHeader(true);
                animateHeader(true);
            } else if ((isScrollingDown || shouldHideHeader) && showAnimatedHeader) {
                setShowAnimatedHeader(false);
                animateHeader(false);
            }

            scrollY.setValue(currentScrollY);
            lastScrollY.current = currentScrollY;
            lastScrollTime.current = currentTime;
        },
        [scrollY, showAnimatedHeader, animateHeader]
    );

    const renderFeedTab = ({ item }: { item: { name: string; id: string } }) => {
        const isActive = currentFeed.id === item.id;

        return (
            <TouchableOpacity
                style={[styles.feedTab, isActive && styles.feedTabActive]}
                onPress={() => handleFeedChange(item)}
                activeOpacity={0.8}>
                <ThemedText style={[styles.feedTabText, isActive && styles.feedTabTextActive]}>{item.name}</ThemedText>
            </TouchableOpacity>
        );
    };

    const renderPost = useCallback((post: PostData) => {
        return (
            <PostCard
                icon={post.user?.profile_picture || ""}
                name={post.user?.display_name || "Unknown"}
                username={post.user?.handle || "unknown"}
                userId={post.user?._id || ""}
                caption={post.caption || ""}
                time={
                    post.metadata?.createdAt
                        ? Math.abs(new Date().getTime() - new Date(post.metadata.createdAt).getTime()) /
                          36e5
                        : 0
                }
                priority="low"
                points={0}
                timeTaken={0}
                category={post.task?.category?.name}
                taskName={post.task?.content}
                reactions={
                    post.reactions
                        ? Object.entries(post.reactions).map(([emoji, userIds]) => ({
                              emoji,
                              count: userIds.length,
                              ids: userIds,
                          }))
                        : []
                }
                comments={post.comments || []}
                images={post.images || []}
                onReactionUpdate={() => refreshSinglePost(post._id)}
                onHeightChange={(imageHeight) => handlePostHeightChange(post._id, imageHeight)}
                id={post._id}
            />
        );
    }, [refreshSinglePost, handlePostHeightChange]);

    const renderHeader = useCallback(() => {
        return (
            <View style={styles.listHeader}>
                <View style={styles.headerContainer}>
                    <Image source={require("@/assets/splash-icon.png")} style={{ width: 32, height: 32 }} />
                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => {
                            router.push("/(logged-in)/(tabs)/(feed)/Notifications");
                        }}
                        style={{ position: 'relative' }}>
                        <Ionicons name="heart-outline" size={32} color={ThemedColor.text} />
                        <View style={{ position: 'absolute', top: -8, right: -8 }}>
                            <NotificationBadge />
                        </View>
                    </TouchableOpacity>
                </View>

                <View style={styles.feedTabsContainer}>
                    <FlatList
                        data={availableFeeds}
                        renderItem={renderFeedTab}
                        keyExtractor={(item) => item.id}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.feedTabsContent}
                    />
                </View>
            </View>
        );
    }, [ThemedColor.text, router, availableFeeds, currentFeed.id, handleFeedChange, renderFeedTab]);

    const renderEmptyComponent = useCallback(() => {
        if (loading) {
            return (
                <View style={styles.loadingContainer}>
                    <Animated.View
                        style={[
                            styles.loadingIcon,
                            {
                                transform: [
                                    {
                                        rotate: loadingRotation.interpolate({
                                            inputRange: [0, 1],
                                            outputRange: ["0deg", "360deg"],
                                        }),
                                    },
                                ],
                            },
                        ]}>
                        <Ionicons name="refresh" size={30} color={ThemedColor.primary} />
                    </Animated.View>
                    <ThemedText style={[styles.loadingText, { color: ThemedColor.text }]}>
                        Loading posts...
                    </ThemedText>
                </View>
            );
        }

        if (error) {
            return (
                <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle-outline" size={50} color={ThemedColor.danger || "#ff4444"} />
                    <ThemedText style={[styles.errorText, { color: ThemedColor.danger || "#ff4444" }]}>
                        {error || "Something went wrong"}
                    </ThemedText>
                    <TouchableOpacity
                        style={[styles.retryButton, { backgroundColor: ThemedColor.primary }]}
                        onPress={() => fetchPosts(currentFeed.id)}>
                        <ThemedText style={styles.retryButtonText}>Try Again</ThemedText>
                    </TouchableOpacity>
                </View>
            );
        }

        if (posts.length === 0) {
            return (
                <View style={styles.emptyContainer}>
                    <Ionicons name="newspaper-outline" size={50} color={ThemedColor.caption} />
                    <ThemedText style={[styles.emptyText, { color: ThemedColor.caption }]}>
                        No posts yet
                    </ThemedText>
                    <ThemedText style={[styles.emptySubtext, { color: ThemedColor.caption }]}>
                        Pull down to refresh
                    </ThemedText>
                </View>
            );
        }

        return null;
    }, [loading, error, posts.length, loadingRotation, ThemedColor, fetchPosts, currentFeed.id]);

    const keyExtractor = useCallback((item: PostData) => item._id || Math.random().toString(), []);

    // Calculate getItemLayout with dynamic heights
    const getItemLayout = useCallback((data: any, index: number) => {
        let offset = HEADER_HEIGHT; // Start with header height
        
        // Add heights of all previous items
        for (let i = 0; i < index; i++) {
            const postId = sortedPosts[i]?._id;
            const postHeight = postHeights[postId] || BASE_POST_HEIGHT;
            offset += postHeight;
        }
        
        const postId = sortedPosts[index]?._id;
        const length = postHeights[postId] || BASE_POST_HEIGHT;
        
        return { length, offset, index };
    }, [sortedPosts, postHeights, BASE_POST_HEIGHT, HEADER_HEIGHT]);

    return (
        <View style={styles.container}>
            <Animated.View
                style={[
                    styles.animatedHeader,
                    {
                        paddingTop: insets.top,
                        transform: [
                            {
                                translateY: headerTranslateY,
                            },
                        ],
                        opacity: headerOpacity,
                    },
                ]}>
                <View>
                    <View style={styles.headerContainer}>
                        <Image source={require("@/assets/splash-icon.png")} style={{ width: 32, height: 32 }} />
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => {
                                router.push("/(logged-in)/(tabs)/(feed)/Notifications");
                            }}
                            style={{ position: 'relative' }}>
                            <Ionicons name="heart-outline" size={32} color={ThemedColor.text} />
                            <View style={{ position: 'absolute', top: -8, right: -8 }}>
                                <NotificationBadge />
                            </View>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.feedTabsContainer}>
                        <FlatList
                            data={availableFeeds}
                            renderItem={renderFeedTab}
                            keyExtractor={(item) => item.id}
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.feedTabsContent}
                        />
                    </View>
                </View>
            </Animated.View>

            <ScrollView
                ref={scrollViewRef}
                onScroll={handleScroll}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={[ThemedColor.primary]}
                        tintColor={ThemedColor.primary}
                        title="Pull to refresh"
                        titleColor={ThemedColor.text}
                    />
                }
                contentContainerStyle={styles.flatListContent}
            >
                {renderHeader()}
                {loading || error || posts.length === 0 ? (
                    renderEmptyComponent()
                ) : (
                    sortedPosts.map((post) => renderPost(post))
                )}
            </ScrollView>
        </View>
    );
}

const stylesheet = (ThemedColor: any, insets: any) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: ThemedColor.background,
        },
        animatedHeader: {
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 1000,
            backgroundColor: ThemedColor.background,
            borderBottomWidth: 1,
            borderBottomColor: ThemedColor.tertiary,
        },
        staticHeader: {
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 999,
            backgroundColor: ThemedColor.background,
            borderBottomWidth: 1,
            borderBottomColor: ThemedColor.tertiary,
        },
        headerContainer: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            paddingHorizontal: HORIZONTAL_PADDING,
            paddingBottom: 8,
        },
        feedTabsContainer: {
            paddingBottom: 8,
            paddingTop: 8,
        },
        feedTabsContent: {
            paddingHorizontal: 8,
        },
        feedTab: {
            backgroundColor: ThemedColor.background,
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 8,
            marginRight: 8,
            shadowColor: "#000",
            shadowOffset: {
                width: 0,
                height: 1,
            },
            shadowOpacity: 0.05,
            shadowRadius: 4,
            elevation: 2,
        },
        feedTabActive: {
            backgroundColor: ThemedColor.primary,
        },
        feedTabText: {
            fontSize: 16,
            fontWeight: "400",
            color: ThemedColor.text,
            letterSpacing: -0.16,
        },
        feedTabTextActive: {
            color: "#ffffff",
        },
        headerTitle: {
            fontSize: 18,
            fontWeight: "600",
        },
        flatListContent: {
            paddingBottom: 150,
        },
        listHeader: {
            backgroundColor: ThemedColor.background,
            borderBottomWidth: 1,
            borderBottomColor: ThemedColor.tertiary,
            paddingTop: insets.top + 8,
        },
        loadingContainer: {
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            paddingVertical: 20,
        },
        loadingIcon: {
            transform: [{ rotate: "0deg" }],
        },
        loadingText: {
            marginTop: 10,
            fontSize: 16,
        },
        emptyContainer: {
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            paddingVertical: 20,
        },
        emptyText: {
            fontSize: 20,
            fontWeight: "bold",
            marginTop: 10,
        },
        emptySubtext: {
            fontSize: 14,
            marginTop: 5,
        },
        errorContainer: {
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            paddingVertical: 20,
        },
        errorText: {
            fontSize: 18,
            fontWeight: "bold",
            marginTop: 10,
            textAlign: "center",
        },
        retryButton: {
            marginTop: 15,
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
