import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import React from "react";
import { useThemeColor } from "@/hooks/useThemeColor";
import { StyleSheet, View, Dimensions, TouchableOpacity, ScrollView, Image } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import PostCard from "@/components/cards/PostCard";
import { Icons } from "@/constants/Icons";
import { Link, router, useRouter } from "expo-router";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
export default function Feed() {
    const ThemedColor = useThemeColor();
    const styles = stylesheet(ThemedColor);
    const router = useRouter();
    return (
        <ThemedView style={styles.container}>
            <ScrollView style={{ flex: 1 }}>
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
                <PostCard
                    icon={Icons.luffy}
                    name={"Abhik Ray"}
                    username={"beak"}
                    caption={"this is my first post ever wow"}
                    time={3}
                    priority={"high"}
                    points={10}
                    timeTaken={2}
                    reactions={[
                        {
                            emoji: "🔥",
                            count: 3,
                            ids: ["67ba5abb616b5e6544e0137b"],
                        },
                        {
                            emoji: "😨",
                            count: 3,
                            ids: ["67ba5abb616b5e6544e0137b"],
                        },
                        {
                            emoji: "🤡",
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
                        {
                            userId: 3,
                            icon: Icons.lokye,
                            name: "Lok Ye",
                            username: "baby",
                            time: 2,
                            content: "meowwwwwwwww",
                        },
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
                        {
                            userId: 3,
                            icon: Icons.lokye,
                            name: "Lok Ye",
                            username: "baby",
                            time: 2,
                            content: "meowwwwwwwww",
                        },
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
                            content: "blah blah latte i hate lattes g g g  g g g  g g g  g  g  g  g g g g g g g ",
                        },
                        {
                            userId: 3,
                            icon: Icons.lokye,
                            name: "Lok Ye",
                            username: "baby",
                            time: 2,
                            content: "meowwwwwwwww",
                        },
                    ]}
                    images={[Icons.latte, Icons.coffee, Icons.lokye, Icons.luffy]}
                />
            </ScrollView>
        </ThemedView>
    );
}

const stylesheet = (ThemedColor: any) =>
    StyleSheet.create({
        container: {
            flex: 1,
            paddingTop: Dimensions.get("window").height * 0.09,
        },
        headerContainer: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            paddingHorizontal: HORIZONTAL_PADDING,
            paddingBottom: 8,
        },
    });
