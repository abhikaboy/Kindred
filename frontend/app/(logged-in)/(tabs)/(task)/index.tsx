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
import Today from "./today";
import { MotiView } from "moti";
import { Skeleton } from "moti/skeleton";
import { useNavigation, useRouter } from "expo-router";
import BasicCard from "@/components/cards/BasicCard";
import DashboardCards from "@/components/dashboard/DashboardCards";
// import Sparkle from "@/assets/icons/sparkle.svg";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDrawer } from "@/contexts/drawerContext";

type Props = {};

const Home = (props: Props) => {
    // get tasks via api call
    const { user } = useAuth();
    let ThemedColor = useThemeColor();

    const { fetchWorkspaces, selected, workspaces, setSelected, dueTodayTasks, fetchingWorkspaces } = useTasks();
    const { startTodayTasks, pastStartTasks, pastDueTasks, futureTasks, allTasks } = useTasks();
    const [creating, setCreating] = useState(false);

    const insets = useSafeAreaInsets();
    const safeAsync = useSafeAsync();
    const { setIsDrawerOpen } = useDrawer();

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
        console.log("loading workspaces");

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
            drawerType="front"
            onDrawerOpen={() => setIsDrawerOpen(true)}
            onDrawerClose={() => setIsDrawerOpen(false)}>
            <CreateModal visible={creating} setVisible={setCreating} />
            <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
                <TouchableOpacity onPress={() => drawerRef.current?.openDrawer()}>
                    <Feather name="menu" size={24} color={ThemedColor.caption} />
                </TouchableOpacity>

                <ConditionalView condition={selected === ""}>
                    <View style={styles.headerContainer}>
                        <ThemedText type="title" style={styles.title}>
                            Welcome {user?.display_name}! ☀️
                        </ThemedText>

                        <ScrollView style={{ gap: 16 }} contentContainerStyle={{ gap: 16 }}>
                            <MotiView style={{ gap: 16, marginTop: 24 }}>
                                <TouchableOpacity
                                    onPress={() => router.navigate("/(logged-in)/(tabs)/(task)/encouragements")}>
                                    <BasicCard>
                                        <View
                                            style={{
                                                width: 12,
                                                height: 12,
                                                backgroundColor: ThemedColor.error,
                                                borderRadius: 12,
                                                position: "absolute",
                                                right: 0,
                                            }}
                                        />
                                        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                                            <ThemedText type="default">Encouragements</ThemedText>
                                            <ThemedText type="default">2</ThemedText>
                                        </View>
                                    </BasicCard>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => router.navigate("/(logged-in)/(tabs)/(task)/congratulations")}>
                                    <BasicCard>
                                        <View
                                            style={{
                                                width: 12,
                                                height: 12,
                                                backgroundColor: "#FFD700",
                                                borderRadius: 12,
                                                position: "absolute",
                                                right: 0,
                                            }}
                                        />
                                        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                                            <ThemedText type="default">Congratulations</ThemedText>
                                            <ThemedText type="default">1</ThemedText>
                                        </View>
                                    </BasicCard>
                                </TouchableOpacity>
                                <DashboardCards drawerRef={drawerRef} />
                                <ThemedText type="subtitle">Recent Workspaces</ThemedText>
                                <ScrollView horizontal>
                                    <ConditionalView condition={workspaces.length > 0} key="workspaces-container">
                                        <MotiView style={{ flexDirection: "row", gap: 8 }}>
                                            <Skeleton.Group key="workspaces-skeleton" show={fetchingWorkspaces}>
                                                {workspaces.map((workspace) => (
                                                    <Skeleton
                                                        key={workspace.name}
                                                        colors={[ThemedColor.lightened, ThemedColor.lightened + "50"]}>
                                                        <TouchableOpacity
                                                            key={workspace.name}
                                                            onPress={() => {
                                                                setSelected(workspace.name);
                                                            }}
                                                            style={{
                                                                padding: 16,
                                                                borderRadius: 12,
                                                                backgroundColor: ThemedColor.lightened,
                                                                boxShadow: ThemedColor.shadowSmall,
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
