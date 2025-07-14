import { Dimensions, StyleSheet, ScrollView, View, Text, Pressable, Keyboard, FlatList } from "react-native";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
            tags: ["Creative", "Design", "Marketing"],
        },
    ];

    const insets = useSafeAreaInsets();

    const contacts = [
        { id: "1", name: "Abhik Ray", icon: Icons.luffy, handle: "beak", following: true },
        { id: "2", name: "Abhik Ray", icon: Icons.luffy, handle: "beak", following: false },
        { id: "3", name: "Abhik Ray", icon: Icons.luffy, handle: "beak", following: true },
        { id: "4", name: "Abhik Ray", icon: Icons.luffy, handle: "beak", following: false },
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

    type Workspace = {
        id: string;
        previewImage: string;
        userImage: string;
        workspaceName: string;
        username: string;
        name: string;
        time: string;
        subscriberCount: number;
        description: string;
        tags: string[];
    };

    const renderWorkspace = ({ item, index }: { item: Workspace; index: number }) => (
        <BlueprintCard
            previewImage={item.previewImage}
            workspaceName={item.workspaceName}
            username={item.username}
            name={item.name}
            time={item.time}
            subscriberCount={item.subscriberCount}
            description={item.description}
            tags={item.tags}
            id={item.id}
            userImage={item.userImage}
        />
    );

    const renderContacts = ({ item }) => (
        <ContactCard name={item.name} icon={item.icon} handle={item.handle} following={item.following} />
    );

    return (
        <ThemedView
            style={{
                paddingTop: insets.top,
                paddingBottom: insets.bottom,
            }}>
            <View style={{ paddingHorizontal: 16 }}>
                <SearchBox
                    value={searchTerm}
                    placeholder={"Search for your friends!"}
                    onChangeText={setSearchTerm}
                    onSubmit={onSubmit}
                    recent={true}
                    name={"search-page"}
                    setFocused={setFocused}
                />
            </View>

            <ScrollView style={{ paddingVertical: Dimensions.get("screen").height * 0.03 }}>
                <Pressable style={{ gap: 16 }} onPress={() => Keyboard.dismiss()}>
                    <ThemedText style={{ paddingHorizontal: 16 }} type="subtitle">
                        Fitness
                    </ThemedText>

                    <FlatList
                        data={workspaces}
                        renderItem={renderWorkspace}
                        keyExtractor={(item) => item.id}
                        horizontal={true}
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ paddingHorizontal: 16, gap: 20 }}
                        ItemSeparatorComponent={() => <View style={{ width: 4 }} />}
                    />
                    {!searched && (
                        <Animated.View style={focusStyle} entering={FadeIn} exiting={FadeOut}>
                            <ThemedText type="subtitle" style={{ marginTop: 32, paddingHorizontal: 16 }}>
                                Suggested For You
                            </ThemedText>
                            <FlatList
                                data={contacts}
                                renderItem={renderContacts}
                                keyExtractor={(item) => item.id}
                                horizontal={true}
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={{ gap: 16, marginTop: 16, paddingHorizontal: 16 }}
                            />
                        </Animated.View>
                    )}
                    <ThemedText type="subtitle" style={{ marginTop: 30, paddingHorizontal: 16 }}>
                        Creativity
                    </ThemedText>
                    <FlatList
                        data={workspaces}
                        renderItem={renderWorkspace}
                        keyExtractor={(item) => item.id}
                        horizontal={true}
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ paddingHorizontal: 16, gap: 20 }}
                        ItemSeparatorComponent={() => <View style={{ width: 4 }} />}
                    />
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
