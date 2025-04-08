import { View, Dimensions, ScrollView, FlatList, useColorScheme } from "react-native";
import React from "react";
import { ThemedText } from "@/components/ThemedText";
import { getThemedColor } from "@/constants/Colors";
import ContactCard from "@/components/cards/ContactCard";
import ThemedCalendar from "@/components/inputs/ThemedCalendar";
import { Icons } from "@/constants/Icons";
import TaskCard from "@/components/cards/TaskCard";
import PostCard from "@/components/cards/PostCard";
import UserInfoRowBase from "@/components/UserInfo/UserInfoRowBase";
import FollowButton from "@/components/inputs/FollowButton";
import UserInfoRowFollow from "@/components/UserInfo/UserInfoRowFollow";
import Entypo from "@expo/vector-icons/Entypo";
import UserInfoRowTimed from "@/components/UserInfo/UserInfoRowTimed";
import UserInfoRowComment from "@/components/UserInfo/UsereInfoRowComment";

export default function Dev2() {
    const [searchTerm, setSearchTerm] = React.useState("");
    const colorScheme = useColorScheme();
    let ThemedColor = getThemedColor(colorScheme);
    return (
        <View
            style={{
                backgroundColor: ThemedColor.background,
                height: Dimensions.get("screen").height,
                flex: 1,
                paddingTop: Dimensions.get("screen").height * 0.12,
                paddingHorizontal: 24,
                gap: 16,
            }}>
            <ThemedText type="title" style={{ fontWeight: "700" }}>
                Development Components 2 - Cards
            </ThemedText>
            <FlatList
                data={[{ key: "content" }]}
                keyExtractor={(item) => item.key}
                renderItem={() => (
                    <>
                        <ScrollView
                            contentContainerStyle={{
                                gap: 16,
                            }}>
                            <ScrollView horizontal style={{ display: "flex", flexDirection: "row", gap: 16 }}>
                                <ContactCard name="Abhik Ray" icon={Icons.luffy} handle="beak" following={true} />
                                <ContactCard name="Lok Ye" icon={Icons.lokye} handle="lokye" following={false} />
                                <ContactCard name="Coffee" icon={Icons.coffee} handle="coffee" following={true} />
                                <ContactCard name="Latte" icon={Icons.latte} handle="latte" following={false} />
                            </ScrollView>
                            <ThemedCalendar />
                            <TaskCard
                                content="Finish your homework bitch. Finish your homework bitch.Finish your homework bitch. "
                                points={9}
                                priority="3"
                            />
                            <UserInfoRowBase
                                name={"Abhik Ray"}
                                username={"beak"}
                                icon={Icons.luffy}
                                right={<Entypo name="heart" size={24} color="red" />}
                            />
                            <UserInfoRowFollow name={"Abhik Ray"} username={"beak"} icon={Icons.luffy} />
                            <UserInfoRowTimed name={"Abhik Ray"} username={"beak"} time={4} icon={Icons.luffy} />
                            <UserInfoRowComment
                                name={"Abhik Ray"}
                                content={"I love this so. I’m commenting."}
                                time={2}
                                icon={Icons.luffy}
                            />
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
                                        content:
                                            "blah blah latte i hate lattes g g g  g g g  g g g  g  g  g  g g g g g g g ",
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
                                images={[Icons.latte, Icons.coffee, Icons.lokye, Icons.luffy]}></PostCard>
                        </ScrollView>
                    </>
                )}
            />
        </View>
    );
}
