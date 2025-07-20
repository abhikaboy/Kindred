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

    const fetchPosts = useCallback(async () => {
        setLoading(true);
        try {
            const fetchedPosts = await getPostsAPI();
            // Transform API data to match PostCard props format
            // This would need to be adjusted based on actual API response structure
            const postsToUse = (fetchedPosts as any) || [];

            // If API returns empty posts or no posts, use mock data
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
            // Keep using mock data as fallback
            setPosts(mockPosts);
        } finally {
            setLoading(false);
        }
    }, []);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);

        try {
            await fetchPosts();
            showToast("Feed refreshed successfully", "success");
        } catch (error) {
            console.error("Error refreshing feed:", error);
            showToast("Failed to refresh feed", "danger");
        } finally {
            setRefreshing(false);
        }
    }, [fetchPosts]);

    // Load posts on component mount
    useEffect(() => {
        fetchPosts();
    }, [fetchPosts]);

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
                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => {
                        router.push("/(logged-in)/(tabs)/(feed)/Notifications");
                    }}>
                    <View style={styles.headerContainer}>
                        <Image source={require("@/assets/splash-icon.png")} style={{ width: 32, height: 32 }} />
                        <Ionicons name="heart-outline" size={32} color={ThemedColor.text} />
                    </View>
                </TouchableOpacity>
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
                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => {
                            router.push("/(logged-in)/(tabs)/(feed)/Notifications");
                        }}>
                        <View style={styles.headerContainer}>
                            <Image source={require("@/assets/splash-icon.png")} style={{ width: 32, height: 32 }} />
                            <Ionicons name="heart-outline" size={32} color={ThemedColor.text} />
                        </View>
                    </TouchableOpacity>
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
        headerTitle: {
            fontSize: 18,
            fontWeight: "600",
        },
        contentContainer: {
            marginTop: 60,
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
