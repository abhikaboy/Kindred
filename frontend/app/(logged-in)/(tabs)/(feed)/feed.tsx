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
import { getPostsAPI } from "@/api/post";
import { showToast } from "@/utils/showToast";

const HORIZONTAL_PADDING = 16;

// Mock data for fallback when API is not available
const mockPosts = [
    {
        icon: Icons.luffy,
        name: "Abhik Ray",
        username: "beak",
        userId: "67ba5abb616b5e6544e0137b",
        caption: "Lowkey just finished jamming on my guitar, learned a few new songs too",
        time: 2,
        priority: "high",
        points: 10,
        timeTaken: 2,
        category: "Music",
        taskName: "Daily Practice",
        reactions: [
            { emoji: "🔥", count: 4, ids: ["67ba5abb616b5e6544e0137b"] },
            { emoji: "💸", count: 3, ids: ["67ba5abb616b5e6544e0137b"] },
            { emoji: "😃", count: 1, ids: ["67ba5abb616b5e6544e0137b"] },
        ],
        comments: [
            {
                userId: 1,
                icon: Icons.luffy,
                name: "luffy",
                username: "theLuffiestOfThemAll",
                time: 1708800000,
                content: "This is such a great post! Thanks for sharing.",
            },
            {
                userId: 2,
                icon: Icons.coffee,
                name: "Coffeeeeee",
                username: "coffee",
                time: 3,
                content: "blah blah latte i hate lattes",
            },
        ],
        images: [Icons.latte, Icons.coffee, Icons.lokye, Icons.luffy],
    },
    {
        icon: Icons.coffee,
        name: "Coffee Lover",
        username: "coffeeaddict",
        userId: "67ba5abb616b5e6544e0137c",
        caption: "Just finished my morning routine and feeling great! Ready to tackle the day ahead.",
        time: 0.5,
        priority: "medium",
        points: 5,
        timeTaken: 1,
        category: "Wellness",
        taskName: "Morning Routine",
        reactions: [
            { emoji: "☕", count: 2, ids: ["67ba5abb616b5e6544e0137b"] },
            { emoji: "💪", count: 1, ids: ["67ba5abb616b5e6544e0137b"] },
        ],
        comments: [
            {
                userId: 1,
                icon: Icons.luffy,
                name: "luffy",
                username: "theLuffiestOfThemAll",
                time: 1708800000,
                content: "Great way to start the day!",
            },
        ],
        images: [],
    },
    {
        icon: Icons.lokye,
        name: "Lok Ye",
        username: "lokye",
        userId: "67ba5abb616b5e6544e0137d",
        caption:
            "Just completed my workout session! Feeling energized and ready to crush the rest of the day. Consistency is key! 💪",
        time: 1.5,
        priority: "high",
        points: 15,
        timeTaken: 1.5,
        category: "Fitness",
        taskName: "Gym Session",
        reactions: [
            { emoji: "💪", count: 8, ids: ["67ba5abb616b5e6544e0137b"] },
            { emoji: "🔥", count: 5, ids: ["67ba5abb616b5e6544e0137b"] },
            { emoji: "👏", count: 3, ids: ["67ba5abb616b5e6544e0137b"] },
        ],
        comments: [
            {
                userId: 1,
                icon: Icons.luffy,
                name: "luffy",
                username: "theLuffiestOfThemAll",
                time: 1708800000,
                content: "Keep up the great work!",
            },
            {
                userId: 2,
                icon: Icons.coffee,
                name: "Coffeeeeee",
                username: "coffee",
                time: 3,
                content: "Inspiring! What's your routine?",
            },
        ],
        images: [Icons.luffy],
    },
    {
        icon: Icons.latte,
        name: "Study Buddy",
        username: "studybuddy",
        userId: "67ba5abb616b5e6544e0137e",
        caption:
            "Finally finished that research paper! 6 hours of focused work and it's finally done. Time for a well-deserved break.",
        time: 4,
        priority: "medium",
        points: 20,
        timeTaken: 6,
        category: "Study",
        taskName: "Research Paper",
        reactions: [
            { emoji: "📚", count: 6, ids: ["67ba5abb616b5e6544e0137b"] },
            { emoji: "🎉", count: 4, ids: ["67ba5abb616b5e6544e0137b"] },
            { emoji: "💯", count: 2, ids: ["67ba5abb616b5e6544e0137b"] },
        ],
        comments: [
            {
                userId: 1,
                icon: Icons.luffy,
                name: "luffy",
                username: "theLuffiestOfThemAll",
                time: 1708800000,
                content: "Congrats on finishing!",
            },
        ],
        images: [],
    },
    {
        icon: Icons.coffee,
        name: "Chef Sarah",
        username: "chefsarah",
        userId: "67ba5abb616b5e6544e0137f",
        caption:
            "Made homemade pasta from scratch today! The process was therapeutic and the result was delicious. Cooking is my happy place 🍝",
        time: 3.5,
        priority: "low",
        points: 12,
        timeTaken: 2.5,
        category: "Cooking",
        taskName: "Homemade Pasta",
        reactions: [
            { emoji: "🍝", count: 7, ids: ["67ba5abb616b5e6544e0137b"] },
            { emoji: "👨‍🍳", count: 3, ids: ["67ba5abb616b5e6544e0137b"] },
            { emoji: "😋", count: 5, ids: ["67ba5abb616b5e6544e0137b"] },
        ],
        comments: [
            {
                userId: 1,
                icon: Icons.luffy,
                name: "luffy",
                username: "theLuffiestOfThemAll",
                time: 1708800000,
                content: "Looks amazing! Recipe?",
            },
            {
                userId: 2,
                icon: Icons.coffee,
                name: "Coffeeeeee",
                username: "coffee",
                time: 3,
                content: "I need to try this!",
            },
            {
                userId: 3,
                icon: Icons.lokye,
                name: "Lok Ye",
                username: "lokye",
                time: 2,
                content: "Beautiful presentation!",
            },
        ],
        images: [Icons.latte, Icons.coffee, Icons.lokye],
    },
];

// Mock data for subscribed blueprints
const mockSubscribedBlueprints = [
    { name: "Fitness Blueprint", id: "blueprint_fitness_001" },
    { name: "Study Blueprint", id: "blueprint_study_002" },
    { name: "Cooking Blueprint", id: "blueprint_cooking_003" },
    { name: "Music Blueprint", id: "blueprint_music_004" },
];

// Mock user ID - in real app this would come from auth context
const mockUserId = "67ba5abb616b5e6544e0137b";

export default function Feed() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const ThemedColor = useThemeColor();
    const styles = stylesheet(ThemedColor);
    const [showAnimatedHeader, setShowAnimatedHeader] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [posts, setPosts] = useState(mockPosts);
    const [loading, setLoading] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    // Feed switching state
    const [currentFeed, setCurrentFeed] = useState<{ name: string; id: string }>({
        name: "Friends",
        id: mockUserId,
    });
    const [availableFeeds, setAvailableFeeds] = useState([
        { name: "Friends", id: mockUserId },
        ...mockSubscribedBlueprints,
    ]);

    const scrollY = useRef(new Animated.Value(0)).current;
    const headerOpacity = useRef(new Animated.Value(0)).current;
    const headerTranslateY = useRef(new Animated.Value(-100)).current;
    const loadingRotation = useRef(new Animated.Value(0)).current;
    const lastScrollY = useRef(0);
    const scrollVelocity = useRef(0);
    const lastScrollTime = useRef(Date.now());
    const velocityThreshold = 0.3;

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

    const fetchPosts = useCallback(
        async (feedId?: string) => {
            setLoading(true);
            try {
                // In a real app, you would pass the feedId to the API
                // const fetchedPosts = await getPostsAPI(feedId);
                console.log(`Fetching posts for feed: ${feedId || currentFeed.id}`);

                // For now, we'll use mock data for all feeds
                // In the real implementation, you would:
                // - If feedId === userId: fetch posts from friends
                // - If feedId is a blueprint id: fetch posts from that blueprint
                const postsToUse = mockPosts;

                if (!postsToUse || postsToUse.length === 0) {
                    console.log("API returned empty posts, using mock data");
                    setPosts(mockPosts);
                } else {
                    setPosts(postsToUse);
                }

                setLastUpdated(new Date());
            } catch (error) {
                console.error("Error fetching posts:", error);
                showToast("Failed to load posts", "danger");
                setPosts(mockPosts);
            } finally {
                setLoading(false);
            }
        },
        [currentFeed.id]
    );

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
    }, [fetchPosts, currentFeed.id]);

    const handleFeedChange = useCallback((feed: { name: string; id: string }) => {
        setCurrentFeed(feed);
        // Posts will be fetched automatically via useEffect
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
                            }}>
                            <Ionicons name="heart-outline" size={32} color={ThemedColor.text} />
                        </TouchableOpacity>
                    </View>

                    {/* Feed Tabs */}
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

            <Animated.ScrollView
                style={{ flex: 1, paddingTop: insets.top }}
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
                }>
                <Animated.View
                    style={[
                        styles.staticHeader,
                        {
                            opacity: scrollY.interpolate({
                                inputRange: [0, 50],
                                outputRange: [1, 0],
                                extrapolate: "clamp",
                            }),
                            transform: [
                                {
                                    translateY: scrollY.interpolate({
                                        inputRange: [0, 50],
                                        outputRange: [0, -50],
                                        extrapolate: "clamp",
                                    }),
                                },
                            ],
                        },
                    ]}>
                    <View>
                        <View style={styles.headerContainer}>
                            <Image source={require("@/assets/splash-icon.png")} style={{ width: 32, height: 32 }} />
                            <TouchableOpacity
                                activeOpacity={0.8}
                                onPress={() => {
                                    router.push("/(logged-in)/(tabs)/(feed)/Notifications");
                                }}>
                                <Ionicons name="heart-outline" size={32} color={ThemedColor.text} />
                            </TouchableOpacity>
                        </View>

                        {/* Feed Tabs */}
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

                <View style={styles.contentContainer}>
                    {loading ? (
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
                    ) : posts.length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <Ionicons name="newspaper-outline" size={50} color={ThemedColor.caption} />
                            <ThemedText style={[styles.emptyText, { color: ThemedColor.caption }]}>
                                No posts yet
                            </ThemedText>
                            <ThemedText style={[styles.emptySubtext, { color: ThemedColor.caption }]}>
                                Pull down to refresh
                            </ThemedText>
                        </View>
                    ) : (
                        posts.map((post, index) => (
                            <PostCard
                                key={index}
                                icon={post.icon}
                                name={post.name}
                                username={post.username}
                                userId={post.userId}
                                caption={post.caption}
                                time={post.time}
                                priority={post.priority}
                                points={post.points}
                                timeTaken={post.timeTaken}
                                category={post.category}
                                taskName={post.taskName}
                                reactions={post.reactions}
                                comments={post.comments}
                                images={post.images}
                            />
                        ))
                    )}
                </View>
            </Animated.ScrollView>
        </View>
    );
}

const stylesheet = (ThemedColor: any) =>
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
        contentContainer: {
            marginTop: 100,
            paddingBottom: HORIZONTAL_PADDING,
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
    });
