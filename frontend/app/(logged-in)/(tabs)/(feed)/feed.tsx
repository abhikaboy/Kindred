import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import PostCard from "@/components/cards/PostCard";
import { Icons } from "@/constants/Icons";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import React, { useState, useRef, useCallback } from "react";
import { useThemeColor } from "@/hooks/useThemeColor";
import { StyleSheet, View, Dimensions, TouchableOpacity, ScrollView, Image, Animated } from "react-native";

const HORIZONTAL_PADDING = 16;

export default function Feed() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const ThemedColor = useThemeColor();
    const styles = stylesheet(ThemedColor);
    const [showAnimatedHeader, setShowAnimatedHeader] = useState(false);

    const scrollY = useRef(new Animated.Value(0)).current;
    const headerOpacity = useRef(new Animated.Value(0)).current;
    const headerTranslateY = useRef(new Animated.Value(-100)).current;
    const lastScrollY = useRef(0);
    const scrollVelocity = useRef(0);
    const lastScrollTime = useRef(Date.now());
    const velocityThreshold = 0.3;

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
                showsVerticalScrollIndicator={false}>
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
                    <PostCard
                        icon={Icons.luffy}
                        name={"Abhik Ray"}
                        username={"beak"}
                        caption={"Lowkey just finished jamming on my guitar, learned a few new songs too"}
                        time={2}
                        priority={"high"}
                        points={10}
                        timeTaken={2}
                        category={"Music"}
                        taskName={"Daily Practice"}
                        reactions={[
                            {
                                emoji: "🔥",
                                count: 4,
                                ids: ["67ba5abb616b5e6544e0137b"],
                            },
                            {
                                emoji: "💸",
                                count: 3,
                                ids: ["67ba5abb616b5e6544e0137b"],
                            },
                            {
                                emoji: "😃",
                                count: 1,
                                ids: ["67ba5abb616b5e6544e0137b"],
                            },
                        ]}
                        comments={[
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
                        ]}
                        images={[Icons.latte, Icons.coffee, Icons.lokye, Icons.luffy]}
                    />

                    <PostCard
                        icon={Icons.coffee}
                        name={"Coffee Lover"}
                        username={"coffeeaddict"}
                        caption={"Just finished my morning routine and feeling great! Ready to tackle the day ahead."}
                        time={0.5}
                        priority={"medium"}
                        points={5}
                        timeTaken={1}
                        category={"Wellness"}
                        taskName={"Morning Routine"}
                        reactions={[
                            {
                                emoji: "☕",
                                count: 2,
                                ids: ["67ba5abb616b5e6544e0137b"],
                            },
                            {
                                emoji: "💪",
                                count: 1,
                                ids: ["67ba5abb616b5e6544e0137b"],
                            },
                        ]}
                        comments={[
                            {
                                userId: 1,
                                icon: Icons.luffy,
                                name: "luffy",
                                username: "theLuffiestOfThemAll",
                                time: 1708800000,
                                content: "Great way to start the day!",
                            },
                        ]}
                        images={[]}
                    />

                    <PostCard
                        icon={Icons.lokye}
                        name={"Lok Ye"}
                        username={"lokye"}
                        caption={
                            "Just completed my workout session! Feeling energized and ready to crush the rest of the day. Consistency is key! 💪"
                        }
                        time={1.5}
                        priority={"high"}
                        points={15}
                        timeTaken={1.5}
                        category={"Fitness"}
                        taskName={"Gym Session"}
                        reactions={[
                            {
                                emoji: "💪",
                                count: 8,
                                ids: ["67ba5abb616b5e6544e0137b"],
                            },
                            {
                                emoji: "🔥",
                                count: 5,
                                ids: ["67ba5abb616b5e6544e0137b"],
                            },
                            {
                                emoji: "👏",
                                count: 3,
                                ids: ["67ba5abb616b5e6544e0137b"],
                            },
                        ]}
                        comments={[
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
                        ]}
                        images={[Icons.luffy]}
                    />

                    <PostCard
                        icon={Icons.latte}
                        name={"Study Buddy"}
                        username={"studybuddy"}
                        caption={
                            "Finally finished that research paper! 6 hours of focused work and it's finally done. Time for a well-deserved break."
                        }
                        time={4}
                        priority={"medium"}
                        points={20}
                        timeTaken={6}
                        reactions={[
                            {
                                emoji: "📚",
                                count: 6,
                                ids: ["67ba5abb616b5e6544e0137b"],
                            },
                            {
                                emoji: "🎉",
                                count: 4,
                                ids: ["67ba5abb616b5e6544e0137b"],
                            },
                            {
                                emoji: "💯",
                                count: 2,
                                ids: ["67ba5abb616b5e6544e0137b"],
                            },
                        ]}
                        comments={[
                            {
                                userId: 1,
                                icon: Icons.luffy,
                                name: "luffy",
                                username: "theLuffiestOfThemAll",
                                time: 1708800000,
                                content: "Congrats on finishing!",
                            },
                        ]}
                        images={[]}
                    />

                    <PostCard
                        icon={Icons.coffee}
                        name={"Chef Sarah"}
                        username={"chefsarah"}
                        caption={
                            "Made homemade pasta from scratch today! The process was therapeutic and the result was delicious. Cooking is my happy place 🍝"
                        }
                        time={3.5}
                        priority={"low"}
                        points={12}
                        timeTaken={2.5}
                        category={"Cooking"}
                        taskName={"Homemade Pasta"}
                        reactions={[
                            {
                                emoji: "🍝",
                                count: 7,
                                ids: ["67ba5abb616b5e6544e0137b"],
                            },
                            {
                                emoji: "👨‍🍳",
                                count: 3,
                                ids: ["67ba5abb616b5e6544e0137b"],
                            },
                            {
                                emoji: "😋",
                                count: 5,
                                ids: ["67ba5abb616b5e6544e0137b"],
                            },
                        ]}
                        comments={[
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
                        ]}
                        images={[Icons.latte, Icons.coffee, Icons.lokye]}
                    />

                    <PostCard
                        icon={Icons.luffy}
                        name={"Bookworm"}
                        username={"bookworm"}
                        caption={
                            "Just finished 'The Midnight Library' by Matt Haig. What a beautiful exploration of life's infinite possibilities. Highly recommend for anyone going through a rough patch."
                        }
                        time={6}
                        priority={"low"}
                        points={8}
                        timeTaken={4}
                        category={"Reading"}
                        taskName={"Book Club Pick"}
                        reactions={[
                            {
                                emoji: "📖",
                                count: 3,
                                ids: ["67ba5abb616b5e6544e0137b"],
                            },
                            {
                                emoji: "❤️",
                                count: 2,
                                ids: ["67ba5abb616b5e6544e0137b"],
                            },
                        ]}
                        comments={[
                            {
                                userId: 1,
                                icon: Icons.luffy,
                                name: "luffy",
                                username: "theLuffiestOfThemAll",
                                time: 1708800000,
                                content: "Adding to my reading list!",
                            },
                        ]}
                        images={[]}
                    />

                    <PostCard
                        icon={Icons.lokye}
                        name={"Artistic Soul"}
                        username={"artisticsoul"}
                        caption={
                            "Spent the afternoon painting and it was exactly what I needed. Art has this incredible way of helping me process emotions. Here's what came out of today's session."
                        }
                        time={0.8}
                        priority={"medium"}
                        points={18}
                        timeTaken={3}
                        category={"Art"}
                        taskName={"Creative Expression"}
                        reactions={[
                            {
                                emoji: "🎨",
                                count: 9,
                                ids: ["67ba5abb616b5e6544e0137b"],
                            },
                            {
                                emoji: "✨",
                                count: 4,
                                ids: ["67ba5abb616b5e6544e0137b"],
                            },
                            {
                                emoji: "👏",
                                count: 2,
                                ids: ["67ba5abb616b5e6544e0137b"],
                            },
                        ]}
                        comments={[
                            {
                                userId: 1,
                                icon: Icons.luffy,
                                name: "luffy",
                                username: "theLuffiestOfThemAll",
                                time: 1708800000,
                                content: "This is beautiful!",
                            },
                            {
                                userId: 2,
                                icon: Icons.coffee,
                                name: "Coffeeeeee",
                                username: "coffee",
                                time: 3,
                                content: "Love the colors!",
                            },
                        ]}
                        images={[Icons.coffee]}
                    />
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
    });
