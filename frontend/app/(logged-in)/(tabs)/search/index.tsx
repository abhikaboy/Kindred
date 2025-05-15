import { Dimensions, StyleSheet, ScrollView, View, Text, Pressable, Keyboard } from "react-native";
import React, { useEffect } from "react";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import TaskCard, { PRIORITY_MAP } from "@/components/cards/TaskCard";
import { SearchBox } from "@/components/SearchBox";
import ContactCard from "@/components/cards/ContactCard";
import { Icons } from "@/constants/Icons";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import * as SMS from "expo-sms";
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import UserInfoRowFollow from "@/components/UserInfo/UserInfoRowFollow";
import { useThemeColor } from "@/hooks/useThemeColor";
import * as Contacts from "expo-contacts";
import BlueprintCard from "@/components/cards/BlueprintCard";
import { useBlueprints } from "@/contexts/blueprintContext";

type Props = {};

const Search = (props: Props) => {
    const workspaces = [
        {
            id: "12345678",
            previewImage: "https://images.unsplash.com/photo-1519389950473-47ba0277781c",
            userImage: "https://images.unsplash.com/photo-1542744173-8e7e53415bb0",
            workspaceName: "Tech Innovators",
            username: "techinnovate",
            name: "lok ye",
            time: "2 hours ago",
            subscriberCount: 1248,
            description: "A community of tech enthusiasts sharing the latest innovations and projects.",
            tasks: [
                {
                    content: "Complete AI chatbot integration",
                    value: 5,
                    priority: 3,
                    id: "task-001",
                    categoryId: "cat-001",
                },
                {
                    content: "Design new landing page",
                    value: 3,
                    priority: 2,
                    id: "task-002",
                    categoryId: "cat-002",
                },
            ],
            tags: ["AI", "Programming", "Design"],
        },
        {
            id: "123456789",
            previewImage: "https://images.unsplash.com/photo-1542744173-8e7e53415bb0",
            userImage: "https://images.unsplash.com/photo-1542744173-8e7e53415bb0",
            workspaceName: "Creative Minds",
            username: "creativeminds",
            name: "lok ye",
            time: "1 day ago",
            subscriberCount: 956,
            description: "A workspace for creative professionals to share ideas and collaborate on projects.",
            tasks: [
                {
                    content: "Brainstorm new campaign concepts",
                    value: 4,
                    priority: 1,
                    id: "task-003",
                    categoryId: "cat-003",
                },
            ],
            tags: ["AI", "Design", "Marketing"],
        },
        {
            id: "1234567891",
            previewImage: "https://images.unsplash.com/photo-1519389950473-47ba0277781c",
            userImage: "https://images.unsplash.com/photo-1542744173-8e7e53415bb0",
            workspaceName: "Tech Innovators",
            username: "techinnovate",
            name: "lok ye",
            time: "2 hours ago",
            subscriberCount: 1248,
            description: "A community of tech enthusiasts sharing the latest innovations and projects.",
            tasks: [
                {
                    content: "Complete AI chatbot integration",
                    value: 5,
                    priority: 3,
                    id: "task-001",
                    categoryId: "cat-001",
                },
                {
                    content: "Design new landing page",
                    value: 3,
                    priority: 2,
                    id: "task-002",
                    categoryId: "cat-002",
                },
            ],
            tags: ["Creative", "Programming", "Design"],
        },
        {
            id: "1234567892",
            previewImage: "https://images.unsplash.com/photo-1542744173-8e7e53415bb0",
            userImage: "https://images.unsplash.com/photo-1542744173-8e7e53415bb0",
            workspaceName: "Creative Minds",
            username: "creativeminds",
            name: "lok ye",
            time: "1 day ago",
            subscriberCount: 956,
            description: "A workspace for creative professionals to share ideas and collaborate on projects.",
            tasks: [
                {
                    content: "Brainstorm new campaign concepts",
                    value: 4,
                    priority: 1,
                    id: "task-003",
                    categoryId: "cat-003",
                },
            ],
            tags: ["Creative", "Design", "Marketing"],
        },
    ];

    const [searchTerm, setSearchTerm] = React.useState("");
    const [searched, setSearched] = React.useState(false);
    const [focused, setFocused] = React.useState(false);
    const ThemedColor = useThemeColor();

    const opacity = useSharedValue(1);
    const focusStyle = useAnimatedStyle(() => {
        return {
            opacity: opacity.value,
            backgroundColor: ThemedColor.background,
        };
    });

    const onSubmit = () => {
        setSearched(searchTerm.trim() != "");
    };

    useEffect(() => {
        opacity.value = withTiming(focused ? 0.05 : 1);
    }, [focused]);

    const { setBlueprints } = useBlueprints();
    useEffect(() => {
        setBlueprints(workspaces);
    }, []);

    return (
        <ThemedView
            style={{
                paddingVertical: Dimensions.get("screen").height * 0.1,
                paddingHorizontal: 16,
            }}>
            <SearchBox
                value={searchTerm}
                placeholder={"Search for your friends!"}
                onChangeText={setSearchTerm}
                onSubmit={onSubmit}
                recent={true}
                name={"search-page"}
                setFocused={setFocused}
            />
            <ScrollView style={{ paddingVertical: Dimensions.get("screen").height * 0.03 }}>
                <Pressable style={{ gap: 16 }} onPress={() => Keyboard.dismiss()}>
                    <ThemedText type="subtitle">Fitness</ThemedText>

                    <ScrollView horizontal={true} showsHorizontalScrollIndicator={false}>
                        <View style={styles.workspaceGrid}>
                            {workspaces.map((workspace, index) => (
                                <BlueprintCard
                                    key={index}
                                    previewImage={workspace.previewImage}
                                    workspaceName={workspace.workspaceName}
                                    username={workspace.username}
                                    name={workspace.name}
                                    time={workspace.time}
                                    subscriberCount={workspace.subscriberCount}
                                    description={workspace.description}
                                    tags={workspace.tags}
                                    id={workspace.id}
                                />
                            ))}
                        </View>
                    </ScrollView>

                    {!searched && (
                        <Animated.View style={focusStyle} entering={FadeIn} exiting={FadeOut}>
                            <ThemedText type="subtitle" style={{ marginTop: 32 }}>
                                Suggested For You
                            </ThemedText>
                            <ScrollView
                                horizontal={true}
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={{ gap: 16, marginTop: 16 }}>
                                <ContactCard name={"Abhik Ray"} icon={Icons.luffy} handle={"beak"} following={true} />
                                <ContactCard name={"Abhik Ray"} icon={Icons.luffy} handle={"beak"} following={false} />
                                <ContactCard name={"Abhik Ray"} icon={Icons.luffy} handle={"beak"} following={true} />
                                <ContactCard name={"Abhik Ray"} icon={Icons.luffy} handle={"beak"} following={false} />
                            </ScrollView>
                        </Animated.View>
                    )}
                    <ThemedText type="subtitle" style={{ marginTop: 30 }}>
                        Creativity
                    </ThemedText>

                    <ScrollView horizontal={true} showsHorizontalScrollIndicator={false}>
                        <View style={styles.workspaceGrid}>
                            {workspaces.map((workspace, index) => (
                                <BlueprintCard
                                    key={index}
                                    previewImage={workspace.previewImage}
                                    workspaceName={workspace.workspaceName}
                                    username={workspace.username}
                                    name={workspace.name}
                                    time={workspace.time}
                                    subscriberCount={workspace.subscriberCount}
                                    description={workspace.description}
                                    tasks={workspace.tasks}
                                    tags={workspace.tags}
                                />
                            ))}
                        </View>
                    </ScrollView>
                    {searched && (
                        <Animated.View style={[focusStyle]} exiting={FadeOut}>
                            <ThemedText type="subtitle">Results</ThemedText>
                            <ScrollView style={{ marginTop: 20, minHeight: "100%" }}>
                                <View>
                                    <UserInfoRowFollow name={"Abhik Ray"} username={"beak"} icon={Icons.luffy} />
                                    <UserInfoRowFollow name={"Abhik Ray"} username={"beak"} icon={Icons.luffy} />
                                    <UserInfoRowFollow name={"Abhik Ray"} username={"beak"} icon={Icons.luffy} />
                                    <UserInfoRowFollow name={"Abhik Ray"} username={"beak"} icon={Icons.luffy} />
                                    <UserInfoRowFollow name={"Abhik Ray"} username={"beak"} icon={Icons.luffy} />
                                </View>
                            </ScrollView>
                        </Animated.View>
                    )}
                </Pressable>
            </ScrollView>
        </ThemedView>
    );
};

export default Search;

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    workspaceGrid: {
        flexDirection: "row",
        gap: 20,
    },
});
