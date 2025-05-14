import { Dimensions, StyleSheet, ScrollView, View, Touchable, TouchableOpacity } from "react-native";
import React, { useEffect, useRef, useState } from "react";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import TaskCard from "@/components/cards/TaskCard";
import { useAuth } from "@/hooks/useAuth";
import { useRequest } from "@/hooks/useRequest";
import { useTasks } from "@/contexts/tasksContext";
import Feather from "@expo/vector-icons/Feather";
import { Drawer } from "@/components/home/Drawer";

import { DrawerLayout } from "react-native-gesture-handler";
import CreateModal from "@/components/modals/CreateModal";
import BottomMenuModal from "@/components/modals/BottomMenuModal";
import EditCategory from "@/components/modals/edit/EditCategory";
import { useThemeColor } from "@/hooks/useThemeColor";
import { Category } from "../../../components/category";
import Confetti from "react-native-simple-confetti";
import ConfettiCannon from "react-native-confetti-cannon";
import ConditionalView from "@/components/ui/ConditionalView";
import Ionicons from "@expo/vector-icons/Ionicons";
import Timeline from "@/components/home/Timeline";
import { Image } from "react-native";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { HORIZONTAL_PADDING } from "@/constants/Layout";
type Props = {};

const Home = (props: Props) => {
    // get tasks via api call
    const { user } = useAuth();
    let ThemedColor = useThemeColor();

    const { categories, fetchWorkspaces, selected, showConfetti, workspaces, setSelected } = useTasks();

    const [time, setTime] = useState(new Date().toLocaleTimeString());
    const [timeOfDay, setTimeOfDay] = useState("Good Morning! ☀");
    const [creating, setCreating] = useState(false);
    const [editing, setEditing] = useState(false);

    const [focusedCategory, setFocusedCategory] = useState<string>("");

    useEffect(() => {
        fetchWorkspaces();
    }, [user]);

    useEffect(() => {
        setInterval(() => {
            // if (!creating) setTime(new Date().toLocaleTimeString());
        }, 1000);

        // get the hour from the time
        let split = time.split(":");
        let hour = parseInt(split[0]);
        let pm = split[split.length - 1];

        if (pm.includes("PM")) {
            if (hour >= 6) {
                setTimeOfDay("Good Evening! 🌆");
            } else {
                setTimeOfDay("Good Afternoon ☕️");
            }
        }
        if (pm.includes("AM")) {
            if (hour >= 6) {
                setTimeOfDay("Good Morning! ☀");
            } else {
                setTimeOfDay("Good Night 🌙");
            }
        }
    }, []);

    const drawerRef = useRef<DrawerLayout>(null);
    return (
        <DrawerLayout
            ref={drawerRef}
            hideStatusBar
            edgeWidth={50}
            drawerWidth={Dimensions.get("screen").width * 0.75}
            renderNavigationView={() => <Drawer close={drawerRef.current?.closeDrawer} />}
            drawerPosition="left"
            drawerType="front">
            <ConditionalView condition={showConfetti}>
                <View
                    style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        zIndex: 1000,
                        height: Dimensions.get("screen").height,
                    }}>
                    <ConfettiCannon
                        count={50}
                        origin={{
                            x: Dimensions.get("screen").width / 2,
                            y: (Dimensions.get("screen").height / 4) * 3.7,
                        }}
                        fallSpeed={1200}
                        explosionSpeed={300}
                        fadeOut={true}
                    />
                </View>
            </ConditionalView>
            <CreateModal visible={creating} setVisible={setCreating} />
            <EditCategory editing={editing} setEditing={setEditing} id={focusedCategory} />
            <ThemedView style={styles.container}>
                <TouchableOpacity onPress={() => drawerRef.current?.openDrawer()}>
                    <Feather name="menu" size={24} color={ThemedColor.caption} />
                </TouchableOpacity>
                <ConditionalView condition={selected !== ""}>
                    <View style={styles.headerContainer}>
                        <ThemedText type="title" style={styles.title}>
                            {selected || "Good Morning! ☀"}
                        </ThemedText>
                        <ThemedText type="lightBody">
                            Treat yourself to a cup of coffee and a good book. You deserve it.
                        </ThemedText>
                    </View>
                </ConditionalView>
                <ConditionalView condition={selected !== ""}>
                    <ScrollView>
                        <View style={styles.categoriesContainer}>
                            {categories
                                .sort((a, b) => b.tasks.length - a.tasks.length)
                                .map((category) => {
                                    if (category.name === "!-proxy-!") {
                                        if (categories.length === 1) {
                                            return (
                                                <View key={category.id + category.name}>
                                                    <ThemedText>You have no workspaces!</ThemedText>
                                                </View>
                                            );
                                        }
                                    } else
                                        return (
                                            <Category
                                                key={category.id + category.name}
                                                id={category.id}
                                                name={category.name}
                                                tasks={category.tasks}
                                                onLongPress={(categoryId) => {
                                                    setEditing(true);
                                                    setFocusedCategory(categoryId);
                                                }}
                                                onPress={(categoryId) => {
                                                    setCreating(true);
                                                    setFocusedCategory(categoryId);
                                                }}
                                            />
                                        );
                                })}
                            <TouchableOpacity
                                onPress={() => setCreating(true)}
                                style={[styles.addButton, { backgroundColor: ThemedColor.lightened }]}>
                                <ThemedText type="defaultSemiBold">+</ThemedText>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </ConditionalView>

                <ConditionalView condition={selected === ""}>
                    <View style={styles.headerContainer}>
                        <ThemedText type="title" style={styles.title}>
                            Welcome {user?.display_name}! ☀️
                        </ThemedText>
                        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                            <ThemedText type="lightBody">{new Date().toDateString()}</ThemedText>
                            <Ionicons name="return-down-back-outline" size={24} color={ThemedColor.text} />
                        </View>
                        <View>
                            <Timeline />
                        </View>
                        <View style={{ gap: 8, marginTop: 24 }}>
                            <ThemedText type="subtitle">Recent Workspaces</ThemedText>
                            <ScrollView horizontal>
                                <ConditionalView condition={workspaces.length > 0}>
                                    <View style={{ flexDirection: "row", gap: 8 }}>
                                        {workspaces.map((workspace) => (
                                            <TouchableOpacity
                                                onPress={() => {
                                                    setSelected(workspace.name);
                                                }}
                                                style={{
                                                    padding: 16,
                                                    borderRadius: 12,
                                                    backgroundColor: ThemedColor.lightened,
                                                }}>
                                                <ThemedText type="lightBody">{workspace.name}</ThemedText>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </ConditionalView>
                                <TouchableOpacity
                                    onPress={() => setCreating(true)}
                                    style={{
                                        padding: 16,
                                        borderRadius: 12,
                                        backgroundColor: ThemedColor.lightened,
                                    }}>
                                    <ThemedText type="lightBody">+ Create Workspace</ThemedText>
                                </TouchableOpacity>
                            </ScrollView>
                        </View>
                        <View>
                            <View
                                style={{
                                    width: "100%",
                                    marginTop: 48,
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 16,
                                }}>
                                <Image
                                    source={require("@/assets/images/Checkmark.png")}
                                    style={{ width: "30%", resizeMode: "contain" }}
                                />
                                <ThemedText type="subtitle">Woohoo! All Clear!</ThemedText>
                            </View>
                        </View>
                    </View>
                </ConditionalView>
            </ThemedView>
        </DrawerLayout>
    );
};

export default Home;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: Dimensions.get("screen").height * 0.09,
        paddingHorizontal: HORIZONTAL_PADDING,
        paddingBottom: Dimensions.get("screen").height * 0.12,
    },
    headerContainer: {
        paddingBottom: 24,
        paddingTop: 20,
        gap: 8,
    },
    title: {
        fontWeight: "600",
    },
    categoriesContainer: {
        gap: 16,
        marginTop: 0,
    },
    addButton: {
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        paddingVertical: 12,
        borderRadius: 12,
    },
});
