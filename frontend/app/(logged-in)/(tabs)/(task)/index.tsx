import { Dimensions, StyleSheet, ScrollView, View, TouchableOpacity } from "react-native";
import React, { useEffect, useRef, useState } from "react";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useAuth } from "@/hooks/useAuth";
import { useTasks } from "@/contexts/tasksContext";
import Feather from "@expo/vector-icons/Feather";
import { Drawer } from "@/components/home/Drawer";
import { DrawerLayout } from "react-native-gesture-handler";
import CreateModal from "@/components/modals/CreateModal";
import { useThemeColor } from "@/hooks/useThemeColor";
import ConditionalView from "@/components/ui/ConditionalView";
import Ionicons from "@expo/vector-icons/Ionicons";
import Timeline from "@/components/home/Timeline";
import { Image } from "react-native";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import { useSafeAsync } from "@/hooks/useSafeAsync";
import Workspace from "./workspace";
import SwipableTaskCard from "@/components/cards/SwipableTaskCard";
import Today from "./today";
import { MotiView } from "moti";
import { Skeleton } from "moti/skeleton";

type Props = {};

const Home = (props: Props) => {
    // get tasks via api call
    const { user } = useAuth();
    let ThemedColor = useThemeColor();

    const { fetchWorkspaces, selected, workspaces, setSelected, dueTodayTasks, fetchingWorkspaces } = useTasks();
    const { startTodayTasks, pastStartTasks, pastDueTasks, futureTasks, allTasks } = useTasks();
    const [creating, setCreating] = useState(false);

    const safeAsync = useSafeAsync();

    useEffect(() => {
        if (!user || !workspaces) return;
        if (user._id === "") return;
        const loadWorkspaces = async () => {
            const { error } = await safeAsync(async () => {
                await fetchWorkspaces();
            });

            if (error) {
                console.error("Error fetching workspaces:", error);
            }
        };

        loadWorkspaces();
    }, [user]);

    const drawerRef = useRef<DrawerLayout>(null);

    if (selected == "Today") {
        return <Today />;
    }

    // If a workspace is selected, show the workspace component
    if (selected !== "") {
        return <Workspace />;
    }

    return (
        <DrawerLayout
            ref={drawerRef}
            hideStatusBar
            edgeWidth={50}
            drawerWidth={Dimensions.get("screen").width * 0.75}
            renderNavigationView={() => <Drawer close={drawerRef.current?.closeDrawer} />}
            drawerPosition="left"
            drawerType="front">
            <CreateModal visible={creating} setVisible={setCreating} />
            <ThemedView style={styles.container}>
                <TouchableOpacity onPress={() => drawerRef.current?.openDrawer()}>
                    <Feather name="menu" size={24} color={ThemedColor.caption} />
                </TouchableOpacity>

                <ConditionalView condition={selected === ""}>
                    <View style={styles.headerContainer}>
                        <ThemedText type="title" style={styles.title}>
                            Welcome {user?.display_name}! ☀️
                        </ThemedText>
                        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                            <ThemedText type="lightBody">{new Date().toDateString()}</ThemedText>
                            <Ionicons name="return-down-back-outline" size={24} color={ThemedColor.text} />
                        </View>
                        <View style={{ marginTop: 8 }}>
                            <Timeline />
                        </View>
                        <ScrollView style={{ gap: 16 }} contentContainerStyle={{ gap: 16 }}>
                            <MotiView style={{ gap: 8, marginTop: 24 }}>
                                <Skeleton>
                                    <ThemedText type="subtitle">Recent Workspaces</ThemedText>
                                </Skeleton>
                                <ScrollView horizontal>
                                    <ConditionalView
                                        condition={workspaces.length > 0 && !fetchingWorkspaces}
                                        key="workspaces-container">
                                        <MotiView style={{ flexDirection: "row", gap: 8 }}>
                                            <Skeleton.Group key="workspaces-skeleton" show={fetchingWorkspaces}>
                                                {workspaces.map((workspace) => (
                                                    <Skeleton key={workspace.name} radius="round">
                                                        <TouchableOpacity
                                                            key={workspace.name}
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
                                                    </Skeleton>
                                                ))}
                                            </Skeleton.Group>
                                        </MotiView>
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
                            </MotiView>
                            <View style={{ gap: 8 }}>
                                <ThemedText type="subtitle">Due Today</ThemedText>
                                <ScrollView contentContainerStyle={{ gap: 8 }}>
                                    {dueTodayTasks.map((task) => (
                                        <SwipableTaskCard
                                            key={task.id}
                                            redirect={true}
                                            categoryId={task.categoryID}
                                            task={task}
                                            categoryName={task.categoryName}
                                        />
                                    ))}
                                </ScrollView>
                            </View>
                            <View style={{ gap: 8 }}>
                                <ThemedText type="subtitle">Scheduled for Today</ThemedText>
                                <ScrollView contentContainerStyle={{ gap: 8 }}>
                                    {startTodayTasks.map((task) => (
                                        <SwipableTaskCard
                                            key={task.id}
                                            redirect={true}
                                            categoryId={task.categoryID}
                                            task={task}
                                        />
                                    ))}
                                </ScrollView>
                            </View>
                            <View style={{ gap: 8 }}>
                                <ThemedText type="subtitle">All Tasks</ThemedText>
                                <ScrollView contentContainerStyle={{ gap: 8 }}>
                                    {allTasks.map((task) => (
                                        <SwipableTaskCard
                                            key={task.id}
                                            redirect={true}
                                            categoryId={task.categoryID}
                                            task={task}
                                        />
                                    ))}
                                </ScrollView>
                            </View>
                        </ScrollView>
                    </View>
                </ConditionalView>
            </ThemedView>
        </DrawerLayout>
    );
};

export default Home;

const AllClear = () => {
    return (
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
                    style={{ width: "25%", resizeMode: "contain" }}
                />
                <ThemedText type="subtitle">Woohoo! All Clear!</ThemedText>
            </View>
        </View>
    );
};
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
    },
    title: {
        fontWeight: "600",
    },
});
