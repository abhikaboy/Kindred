import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { feedScrollVisibilityEvents } from "@/utils/feedScrollVisibilityEvents";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import PostCard from "@/components/cards/PostCard";
import ReportedPostCard from "@/components/cards/ReportedPostCard";
import TaskFeedCard from "@/components/cards/TaskFeedCard";
import RingsClosedFeedCard from "@/components/cards/RingsClosedFeedCard";
import { Icons } from "@/constants/Icons";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useAnalytics } from "@/hooks/useAnalytics";
import { AnalyticsEvents } from "@/utils/analytics";
import {
    StyleSheet,
    View,
    Dimensions,
    TouchableOpacity,
    Image,
    Animated,
    RefreshControl,
    useColorScheme,
    FlatList,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { getAllPosts, getFriendsPosts, getPostsByBlueprint, getFeed, type FeedItem } from "@/api/post";
import { getUserSubscribedBlueprints } from "@/api/blueprint";
import { showToast } from "@/utils/showToast";
import NotificationBadge from "@/components/NotificationBadge";
import { PostCardSkeleton } from "@/components/ui/SkeletonLoader";
import { HeartStraightIcon } from "phosphor-react-native";
import { useAuth } from "@/hooks/useAuth";
import { Handshake } from "phosphor-react-native";
import PrimaryButton from "@/components/inputs/PrimaryButton";
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
    dual?: string;
    caption: string;
    size?: {
        width: number;
        height: number;
        bytes: number;
    };
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

    const goToNotifications = useCallback(() => {
        router.push("/(logged-in)/(tabs)/(feed)/Notifications");
    }, [router]);

    // Swipe left on the feed to open Notifications (DM-style). activeOffsetX makes
    // it claim only horizontal drags; failOffsetY yields to the vertical scroll.
    const swipeToNotifications = useMemo(
        () =>
            Gesture.Pan()
                .activeOffsetX([-20, 20])
                .failOffsetY([-15, 15])
                .onEnd((e) => {
                    "worklet";
                    if (e.translationX < -80 || (e.velocityX < -700 && e.translationX < -30)) {
                        runOnJS(goToNotifications)();
                    }
                }),
        [goToNotifications]
    );
    const insets = useSafeAreaInsets();
    const colorScheme = useColorScheme();
    const ThemedColor = useThemeColor();
    const logoSource = colorScheme === "dark"
        ? require("@/assets/splash-icon-dark.png")
        : require("@/assets/splash-icon-light.png");
    const styles = stylesheet(ThemedColor, insets);
    const { user, updateUser } = useAuth();
    const { capture } = useAnalytics();
    const [showAnimatedHeader, setShowAnimatedHeader] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [posts, setPosts] = useState<PostData[]>([]);
    const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [initialLoading, setInitialLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");

    // Hidden/blocked state for immediate UX feedback
    const [hiddenPostIds, setHiddenPostIds] = useState<Set<string>>(new Set());
    const [blockedUserIds, setBlockedUserIds] = useState<Set<string>>(new Set());

    // Pagination state
    const [offset, setOffset] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    // Feed switching state
    const [currentFeed, setCurrentFeed] = useState<{ name: string; id: string }>({
        name: "Feed",
        id: "feed",
    });
    const [availableFeeds, setAvailableFeeds] = useState([
        { name: "Feed", id: "feed" },
        { name: "Friends", id: "friends" },
    ]);
    const [subscribedBlueprints, setSubscribedBlueprints] = useState<any[]>([]);
    const scrollY = useRef(new Animated.Value(0)).current;
    const headerOpacity = useRef(new Animated.Value(0)).current;
    const headerTranslateY = useRef(new Animated.Value(-100)).current;
    const loadingRotation = useRef(new Animated.Value(0)).current;
    const lastScrollY = useRef(0);
    const scrollVelocity = useRef(0);
    const lastScrollTime = useRef(Date.now());
    const velocityThreshold = 0.3;
    const flatListRef = useRef<any>(null);
    const isInitialMount = useRef(true);
    // Tracks whether the tab bar / FAB are currently shown, so we only emit on change.
    const navVisibleRef = useRef(true);

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


    // Fetch subscribed blueprints and update available feeds
    const fetchSubscribedBlueprints = useCallback(async () => {
        try {
            const blueprints = await getUserSubscribedBlueprints();
            setSubscribedBlueprints(blueprints);

            // Create feeds array with base feeds + blueprint feeds
            const baseFeeds = [
                { name: "Feed", id: "feed" },
                { name: "Friends", id: "friends" },
            ];

            const blueprintFeeds = blueprints.map((blueprint) => ({
                name: blueprint.name,
                id: `blueprint-${blueprint.id}`,
            }));

            setAvailableFeeds([...baseFeeds, ...blueprintFeeds]);
        } catch (error) {
            console.error("Error fetching subscribed blueprints:", error);
            // Keep the base feeds if blueprint fetch fails
            setAvailableFeeds([
                { name: "Feed", id: "feed" },
                { name: "Friends", id: "friends" },
            ]);
        }
    }, []);

    const fetchPosts = useCallback(
        async (feedId?: string, resetPagination = true) => {
            setLoading(true);
            try {
                const currentFeedId = feedId || currentFeed.id;
                let result;

                if (currentFeedId === "feed") {
                    // Use the new unified feed endpoint
                    const feedResult = await getFeed(20, 0);
                    setFeedItems(feedResult.items);
                    setPosts([]); // Clear posts state — feed tab uses feedItems exclusively
                    setOffset(feedResult.nextOffset);
                    setHasMore(feedResult.hasMore);
                    setLastUpdated(new Date());
                    setLoading(false);
                    setInitialLoading(false);
                    return;
                } else if (currentFeedId === "friends") {
                    result = await getFriendsPosts(8, 0);
                } else if (currentFeedId.startsWith("blueprint-")) {
                    // Extract blueprint ID from feed ID
                    const blueprintId = currentFeedId.replace("blueprint-", "");
                    const fetchedPosts = await getPostsByBlueprint(blueprintId);
                    // Blueprint posts don't support pagination yet, wrap in result format
                    result = {
                        posts: fetchedPosts,
                        total: fetchedPosts.length,
                        hasMore: false,
                        nextOffset: 0,
                    };
                } else {
                    result = await getAllPosts(8, 0);
                }

                if (!result || !result.posts) {
                    throw new Error("No data received from API");
                }
                if (!Array.isArray(result.posts)) {
                    throw new Error("API response is not an array");
                }

                setPosts(result.posts);
                setFeedItems([]); // Clear feed items for non-feed views
                setOffset(result.nextOffset);
                setHasMore(result.hasMore);
                setLastUpdated(new Date());
            } catch (error) {
                console.error("Error fetching posts:", error);
                showToast(`Failed to load ${feedId || currentFeed.name} posts`, "danger");
                setPosts([]);
                setFeedItems([]);
                setHasMore(false);
            } finally {
                setLoading(false);
                setInitialLoading(false);
            }
        },
        [currentFeed.id, currentFeed.name]
    );

    // Load more posts when scrolling to the end
    const loadMorePosts = useCallback(async () => {
        if (loadingMore || !hasMore || loading) {
            return;
        }

        setLoadingMore(true);
        try {
            const currentFeedId = currentFeed.id;
            let result;

            if (currentFeedId === "feed") {
                const feedResult = await getFeed(20, offset);
                // Append new feed items
                setFeedItems((prev) => [...prev, ...feedResult.items]);
                setOffset(feedResult.nextOffset);
                setHasMore(feedResult.hasMore);
                setLoadingMore(false);
                capture(AnalyticsEvents.FEED_SCROLLED, {
                    page: offset,
                });
                return;
            } else if (currentFeedId === "friends") {
                result = await getFriendsPosts(8, offset);
            } else if (currentFeedId.startsWith("blueprint-")) {
                // Blueprint posts don't support pagination
                setLoadingMore(false);
                return;
            } else {
                result = await getAllPosts(8, offset);
            }

            if (!result || !result.posts) {
                throw new Error("No data received from API");
            }

            // Append new posts to existing posts
            setPosts((prevPosts) => [...prevPosts, ...result.posts]);
            setOffset(result.nextOffset);
            setHasMore(result.hasMore);
            capture(AnalyticsEvents.FEED_SCROLLED, {
                page: offset,
            });
        } catch (error) {
            console.error("Error loading more posts:", error);
            showToast("Failed to load more posts", "danger");
        } finally {
            setLoadingMore(false);
        }
    }, [loadingMore, hasMore, loading, currentFeed.id, offset, capture]);

    // Callbacks for hiding posts and blocking users from feed
    const handleHidePost = useCallback((postId: string) => {
        setHiddenPostIds((prev) => new Set(prev).add(postId));
    }, []);

    const handleBlockUser = useCallback((userId: string) => {
        setBlockedUserIds((prev) => new Set(prev).add(userId));
    }, []);

    const handleDismissHidden = useCallback((postId: string) => {
        setHiddenPostIds((prev) => {
            const next = new Set(prev);
            next.delete(postId);
            return next;
        });
    }, []);

    // Memoize sorted posts to prevent unnecessary recalculations
    // Use spread to avoid mutating the original array
    const sortedPosts = useMemo(() => {
        return [...posts]
            .filter((post) => !blockedUserIds.has(post.user?._id))
            .sort((a, b) => {
                const dateA = new Date(a.metadata?.createdAt || 0);
                const dateB = new Date(b.metadata?.createdAt || 0);
                return dateB.getTime() - dateA.getTime();
            });
    }, [posts, blockedUserIds]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            await fetchPosts(currentFeed.id);
            capture(AnalyticsEvents.PULL_TO_REFRESH, {
                screen_name: "feed",
            });
            showToast("Feed refreshed successfully", "success");
        } catch (error) {
            console.error("Error refreshing feed:", error);
            showToast("Failed to refresh feed", "danger");
        } finally {
            setRefreshing(false);
        }
    }, [fetchPosts, currentFeed.id, capture]);

    // Load blueprints and posts in parallel on component mount
    useEffect(() => {
        const initializeFeed = async () => {
            // Run both API calls in parallel for faster initial load
            await Promise.all([fetchSubscribedBlueprints(), fetchPosts(currentFeed.id)]);
        };

        initializeFeed();
        isInitialMount.current = false;
    }, []); // Only run once on mount


    // Load posts when feed changes (skip initial mount)
    useEffect(() => {
        // Skip if this is the initial render (posts already loaded above)
        if (isInitialMount.current) {
            return;
        }

        // Fetch posts for the new feed
        fetchPosts(currentFeed.id);
    }, [currentFeed.id]);

    // Restore tab bar / FAB visibility when leaving the feed tab so other
    // screens don't inherit a hidden state from a mid-scroll navigation.
    useFocusEffect(
        useCallback(() => {
            navVisibleRef.current = true;
            return () => {
                feedScrollVisibilityEvents.emit(true);
            };
        }, [])
    );

    const handleFeedChange = useCallback((feed: { name: string; id: string }) => {
        setCurrentFeed(feed);
        capture(AnalyticsEvents.FEED_FILTER_CHANGED, {
            feed_id: feed.id,
        });
    }, [capture]);

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

            const atTop = currentScrollY < 50;
            const isScrollingUp = scrollVelocity.current < -velocityThreshold;
            const isScrollingDown = scrollVelocity.current > velocityThreshold && !atTop;

            // Tab bar + FAB: shown at the top or when scrolling up, hidden when
            // scrolling down. Emit only on change so we don't spam subscribers.
            let nextNavVisible = navVisibleRef.current;
            if (atTop || isScrollingUp) nextNavVisible = true;
            else if (isScrollingDown) nextNavVisible = false;
            if (nextNavVisible !== navVisibleRef.current) {
                navVisibleRef.current = nextNavVisible;
                feedScrollVisibilityEvents.emit(nextNavVisible);
            }

            // Floating sticky header: reappears when scrolling up mid-feed, and
            // hides at the top (the in-list header is there) or when scrolling down.
            if (isScrollingUp && currentScrollY > 100 && !showAnimatedHeader) {
                setShowAnimatedHeader(true);
                animateHeader(true);
            } else if ((isScrollingDown || atTop) && showAnimatedHeader) {
                setShowAnimatedHeader(false);
                animateHeader(false);
            }

            scrollY.setValue(currentScrollY);
            lastScrollY.current = currentScrollY;
            lastScrollTime.current = currentTime;
        },
        [scrollY, showAnimatedHeader, animateHeader]
    );

    const renderFeedTab = useCallback(({ item }: { item: { name: string; id: string } }) => {
        const isActive = currentFeed.id === item.id;

        return (
            <TouchableOpacity
                style={[styles.feedTab, isActive && styles.feedTabActive]}
                onPress={() => handleFeedChange(item)}
                activeOpacity={0.8}>
                <ThemedText style={[styles.feedTabText, isActive && styles.feedTabTextActive]}>{item.name}</ThemedText>
            </TouchableOpacity>
        );
    }, [currentFeed.id, handleFeedChange, styles]);

    // Memoize time calculation outside of render
    const calculatePostTime = useCallback((createdAt: string) => {
        return Math.abs(new Date().getTime() - new Date(createdAt).getTime()) / 36e5;
    }, []);

    // Memoize reactions transformation
    const transformReactions = useCallback((reactions: { [emoji: string]: string[] }) => {
        return Object.entries(reactions).map(([emoji, userIds]) => ({
            emoji,
            count: userIds.length,
            ids: userIds,
        }));
    }, []);

    // Filter feed items to exclude blocked users
    const filteredFeedItems = useMemo(() => {
        return feedItems.filter((item) => {
            if (item.type === "post" && item.post) {
                return !blockedUserIds.has(item.post.user?._id);
            }
            return true;
        });
    }, [feedItems, blockedUserIds]);

    const renderFeedItem = useCallback(
        ({ item }: { item: FeedItem }) => {
            if (item.type === "task" && item.task) {
                // Render task card
                const task = item.task;
                return (
                    <TaskFeedCard
                        taskId={task.id}
                        content={task.content}
                        workspaceName={task.workspaceName}
                        categoryName={task.categoryName}
                        timestamp={task.timestamp}
                        priority={task.priority}
                        value={task.value}
                        user={task.user}
                    />
                );
            } else if (item.type === "rings_closed" && item.ringsClosed) {
                const rc = item.ringsClosed;
                return (
                    <RingsClosedFeedCard
                        id={rc.id}
                        timestamp={rc.timestamp}
                        content={rc.content}
                        user={rc.user}
                    />
                );
            } else if (item.type === "post" && item.post) {
                const post = item.post as any;

                // Show reported/hidden placeholder
                if (hiddenPostIds.has(post._id)) {
                    return <ReportedPostCard onDismiss={() => handleDismissHidden(post._id)} />;
                }

                const postTime = post.metadata?.createdAt ? calculatePostTime(post.metadata.createdAt) : 0;
                const postReactions = post.reactions ? transformReactions(post.reactions) : [];

                return (
                    <PostCard
                        icon={post.user?.profile_picture || ""}
                        name={post.user?.display_name || "Unknown"}
                        username={post.user?.handle || "unknown"}
                        userId={post.user?._id || ""}
                        id={post._id}
                        images={post.images}
                        dual={post.dual}
                        caption={post.caption}
                        size={post.size}
                        time={postTime}
                        reactions={postReactions}
                        comments={post.comments}
                        category={post.task?.category?.name}
                        taskName={post.task?.content}
                        onHide={handleHidePost}
                        onBlockUser={handleBlockUser}
                    />
                );
            }
            return null;
        },
        [calculatePostTime, transformReactions, hiddenPostIds, handleHidePost, handleBlockUser, handleDismissHidden]
    );

    const renderPost = useCallback(
        ({ item: post }: { item: PostData }) => {
            // Show reported/hidden placeholder
            if (hiddenPostIds.has(post._id)) {
                return <ReportedPostCard onDismiss={() => handleDismissHidden(post._id)} />;
            }

            const postTime = post.metadata?.createdAt ? calculatePostTime(post.metadata.createdAt) : 0;
            const postReactions = post.reactions ? transformReactions(post.reactions) : [];

            return (
                <PostCard
                    icon={post.user?.profile_picture || ""}
                    name={post.user?.display_name || "Unknown"}
                    username={post.user?.handle || "unknown"}
                    userId={post.user?._id || ""}
                    caption={post.caption || ""}
                    time={postTime}
                    dual={post.dual}
                    priority="low"
                    points={0}
                    timeTaken={0}
                    category={post.task?.category?.name}
                    taskName={post.task?.content}
                    reactions={postReactions}
                    comments={post.comments || []}
                    images={post.images || []}
                    size={post.size}
                    onReactionUpdate={() => refreshSinglePost(post._id)}
                    id={post._id}
                    onHide={handleHidePost}
                    onBlockUser={handleBlockUser}
                />
            );
        },
        [refreshSinglePost, calculatePostTime, transformReactions, hiddenPostIds, handleHidePost, handleBlockUser, handleDismissHidden]
    );

    const renderHeader = useCallback(() => {
        return (
            <View style={styles.listHeader}>
                <View style={styles.headerContainer}>
                    <Image source={logoSource} style={{ width: 32, height: 32 }} />
                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => {
                            router.push("/(logged-in)/(tabs)/(feed)/Notifications");
                        }}
                        style={{ position: "relative" }}>
                        <HeartStraightIcon size={32} weight="regular" color={ThemedColor.text} />
                        <View style={{ position: "absolute", top: -8, right: -8 }}>
                            <NotificationBadge />
                        </View>
                    </TouchableOpacity>
                </View>

                <View style={styles.feedTabsContainer}>
                    <View style={{ minHeight: 2, flex: 1 }}>
                        <FlashList
                            data={availableFeeds}
                            renderItem={renderFeedTab}
                            keyExtractor={(item) => item.id}
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.feedTabsContent}
                        />
                    </View>
                </View>
            </View>
        );
    }, [ThemedColor.text, router, availableFeeds, renderFeedTab]);

    const renderEmptyComponent = useCallback(() => {
        if (posts.length === 0 && !loading) {
            const isFriendsFeed = currentFeed.id === "friends";
            const isBlueprintFeed = currentFeed.id.startsWith("blueprint-");

            if (isBlueprintFeed) {
                return (
                    <View style={styles.emptyContainer}>
                        <ThemedText style={[styles.emptyText, { color: ThemedColor.caption }]}>
                            No posts in {currentFeed.name} yet
                        </ThemedText>
                        <ThemedText style={[styles.emptySubtext, { color: ThemedColor.caption }]}>
                            Create posts using this blueprint to see them here
                        </ThemedText>
                    </View>
                );
            }

            return (
                <View style={styles.emptyContainer}>
                    <View style={[styles.emptyIconRow, { backgroundColor: ThemedColor.primary + "10" }]}>
                        <Handshake size={32} color={ThemedColor.primary} weight="duotone" />
                    </View>
                    <ThemedText style={styles.emptyTitle}>
                        {isFriendsFeed ? "It's quiet... too quiet" : "It's quiet... too quiet"}
                    </ThemedText>
                    <ThemedText style={[styles.emptySubtext, { color: ThemedColor.caption }]}>
                        When your friends complete tasks and share updates, they'll show up here. Send them kudos to keep each other going.
                    </ThemedText>
                    <View style={{ width: "100%", marginTop: 8 }}>
                        <PrimaryButton
                            title="Find friends"
                            secondary
                            onPress={() => router.push("/(logged-in)/(tabs)/(search)/search")}
                        />
                    </View>
                </View>
            );
        }

        // Show skeleton for initial loading
        if (initialLoading) {
            return (
                <View>
                    <PostCardSkeleton />
                    <PostCardSkeleton />
                    <PostCardSkeleton />
                </View>
            );
        }

        return null;
    }, [loading, initialLoading, posts.length, ThemedColor, currentFeed.id, currentFeed.name]);

    const renderFooter = useCallback(() => {
        if (loadingMore) {
            return (
                <View style={styles.loadingMoreContainer}>
                    <PostCardSkeleton />
                </View>
            );
        }

        if (!hasMore && posts.length > 0) {
            return (
                <View style={styles.endOfFeedContainer}>
                    <ThemedText style={styles.endOfFeedText}>You've reached the end! 🎉</ThemedText>
                </View>
            );
        }

        return null;
    }, [loadingMore, hasMore, posts.length]);

    const keyExtractor = useCallback((item: PostData) => item._id, []);

    const handleEndReached = useCallback(() => {
        if (hasMore && !loadingMore && !loading && posts.length > 0) {
            loadMorePosts();
        }
    }, [hasMore, loadingMore, loading, posts.length, loadMorePosts]);

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
                        <Image source={logoSource} style={{ width: 32, height: 32 }} />
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => {
                                router.push("/(logged-in)/(tabs)/(feed)/Notifications");
                            }}
                            style={{ position: "relative" }}>
                            <Ionicons name="heart-outline" size={32} color={ThemedColor.text} />
                            <View style={{ position: "absolute", top: -8, right: -8 }}>
                                <NotificationBadge />
                            </View>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.feedTabsContainer}>
                        <View style={{ minHeight: 2, flex: 1 }}>
                            <FlashList
                                data={availableFeeds}
                                renderItem={renderFeedTab}
                                keyExtractor={(item) => item.id}
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.feedTabsContent}
                            />
                        </View>
                    </View>
                </View>
            </Animated.View>

            <GestureDetector gesture={swipeToNotifications}>
            <FlatList
                ref={flatListRef}
                data={currentFeed.id === "feed" ? filteredFeedItems : sortedPosts}
                keyExtractor={(item) => {
                    if (currentFeed.id === "feed") {
                        const feedItem = item as FeedItem;
                        if (feedItem.type === "post" && feedItem.post) {
                            return `post-${feedItem.post._id}`;
                        } else if (feedItem.type === "rings_closed" && feedItem.ringsClosed) {
                            return `rings-${feedItem.ringsClosed.id}`;
                        }
                        return `task-${feedItem.task?.id}`;
                    }
                    return (item as PostData)._id;
                }}
                renderItem={currentFeed.id === "feed" ? renderFeedItem : renderPost}
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
                ListHeaderComponent={renderHeader}
                ListEmptyComponent={renderEmptyComponent}
                ListFooterComponent={renderFooter}
                onEndReached={handleEndReached}
                onEndReachedThreshold={0.5}
            />
            </GestureDetector>
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
            boxShadow: ThemedColor.smallShadow,
            borderWidth: 0.5,
            borderColor: ThemedColor.tertiary,
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
            paddingHorizontal: 16,
            paddingVertical: 20,
        },
        emptyContainer: {
            flex: 1,
            paddingVertical: 40,
            paddingHorizontal: 24,
            alignItems: "flex-start",
            gap: 12,
        },
        emptyIconRow: {
            width: 64,
            height: 64,
            borderRadius: 32,
            justifyContent: "center",
            alignItems: "center",
            marginBottom: 4,
        },
        emptyTitle: {
            fontSize: 24,
            fontFamily: "Fraunces",
            fontWeight: "500",
            textAlign: "left",
            letterSpacing: -1,
        },
        emptyText: {
            fontSize: 20,
            fontWeight: "bold",
            marginTop: 10,
            width: "70%",
        },
        emptySubtext: {
            fontSize: 15,
            textAlign: "left",
            lineHeight: 22,
        },
        loadingMoreContainer: {
            paddingVertical: 20,
            alignItems: "center",
        },
        endOfFeedContainer: {
            paddingVertical: 32,
            alignItems: "center",
        },
        endOfFeedText: {
            fontSize: 16,
            color: ThemedColor.caption,
            fontWeight: "500",
        },
    });
