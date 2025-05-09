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

import ReanimatedDrawerLayout, {
    DrawerType,
    DrawerPosition,
    DrawerLayoutMethods,
} from "react-native-gesture-handler/ReanimatedDrawerLayout";
import CreateModal from "@/components/modals/CreateModal";
import BottomMenuModal from "@/components/modals/BottomMenuModal";
import EditCategory from "@/components/modals/edit/EditCategory";
import { useThemeColor } from "@/hooks/useThemeColor";
import { Category } from "../../components/category";
import Confetti from "react-native-simple-confetti";
import ConfettiCannon from "react-native-confetti-cannon";

type Props = {};

const Home = (props: Props) => {
    // get tasks via api call
    const { user } = useAuth();
    let ThemedColor = useThemeColor();

    const { categories, fetchWorkspaces, selected, showConfetti } = useTasks();

    const [time, setTime] = useState(new Date().toLocaleTimeString());
    const [timeOfDay, setTimeOfDay] = useState("Good Morning! ☀");
    const [creating, setCreating] = useState(false);
    const [editing, setEditing] = useState(false);

    const [focusedCategory, setFocusedCategory] = useState<string>("");

    useEffect(() => {
        fetchWorkspaces();
    }, []);

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
    const drawerRef = useRef<DrawerLayoutMethods>(null);
    return (
        <ReanimatedDrawerLayout
            ref={drawerRef}
            hideStatusBar
            edgeWidth={50}
            drawerWidth={Dimensions.get("screen").width * 0.75}
            renderNavigationView={() => <Drawer close={drawerRef.current?.closeDrawer} />}
            drawerPosition={DrawerPosition.LEFT}
            drawerType={DrawerType.FRONT}>
            <CreateModal visible={creating} setVisible={setCreating} />
            <EditCategory editing={editing} setEditing={setEditing} id={focusedCategory} />
            <ThemedView style={styles.container}>
                <TouchableOpacity onPress={() => drawerRef.current?.openDrawer()}>
                    <Feather name="menu" size={24} color={ThemedColor.caption} />
                </TouchableOpacity>
                <View style={styles.headerContainer}>
                    <ThemedText type="title" style={styles.title}>
                        {selected || timeOfDay}
                    </ThemedText>
                    <ThemedText type="lightBody">
                        Treat yourself to a cup of coffee and a good book. You deserve it.
                    </ThemedText>
                </View>
                {showConfetti && (
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
                )}
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
            </ThemedView>
        </ReanimatedDrawerLayout>
    );
};

export default Home;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: Dimensions.get("screen").height * 0.1,
        paddingHorizontal: 24,
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
