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
import CreateWorkspaceBottomSheetModal from "@/components/modals/CreateWorkspaceBottomSheetModal";
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
import PrimaryButton from "@/components/inputs/PrimaryButton";
import * as Sentry from "@sentry/react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import Octicons from "@expo/vector-icons/Octicons";

type Props = {};

const Home = (props: Props) => {
    // get tasks via api call
    const { user } = useAuth();
    let ThemedColor = useThemeColor();

    const { fetchWorkspaces, selected, workspaces, setSelected, dueTodayTasks, fetchingWorkspaces } = useTasks();
    const { startTodayTasks, pastStartTasks, pastDueTasks, futureTasks, allTasks } = useTasks();
    const [creating, setCreating] = useState(false);
    const [creatingWorkspace, setCreatingWorkspace] = useState(false);

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
            <CreateWorkspaceBottomSheetModal visible={creatingWorkspace} setVisible={setCreatingWorkspace} />
            
            
            <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
                <TouchableOpacity onPress={() => drawerRef.current?.openDrawer()}>
                    <Feather name="menu" size={24} color={ThemedColor.caption} />
                </TouchableOpacity>

                <ConditionalView condition={selected === ""}>
                    <View style={styles.headerContainer}>
                        <ThemedText type="title" style={styles.title}>
                            Welcome {user?.display_name}! ☀️
                        </ThemedText>

                        <ScrollView style={{ gap: 16 }} contentContainerStyle={{ gap: 16 }} showsVerticalScrollIndicator={false}>
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
                                <PrimaryButton
                                    title="Try!"
                                    onPress={() => {
                                        Sentry.showFeedbackWidget();
                                    }}
                                />
                                <ThemedText type="subtitle">Recent Workspaces</ThemedText>
                                <ScrollView 
                                    horizontal={false}
                                    showsVerticalScrollIndicator={false}
                                    contentContainerStyle={{ paddingBottom: 108 }}>
                                    <ConditionalView condition={workspaces.length > 0} key="workspaces-container">
                                        <View style={styles.workspacesGrid}>
                                            <Skeleton.Group key="workspaces-skeleton" show={fetchingWorkspaces}>
                                                {workspaces.slice(0, 6).map((workspace, index) => (
                                                    <Skeleton
                                                        key={workspace.name}
                                                        colors={[ThemedColor.lightened, ThemedColor.lightened + "50"]}>
                                                        <TouchableOpacity
                                                            key={workspace.name}
                                                            onPress={() => {
                                                                setSelected(workspace.name);
                                                            }}
                                                            style={[
                                                                styles.workspaceCard,
                                                                {
                                                                    backgroundColor: ThemedColor.lightened,
                                                                    borderColor: "#ffffff08",
                                                                    boxShadow: ThemedColor.shadowSmall,
                                                                }
                                                            ]}>
                                                            <View style={styles.workspaceCardContent}>
                                                                <Feather name="feather" size={24} color={ThemedColor.text} />
                                                                <View style={styles.workspaceCardText}>
                                                                    <ThemedText type="default">{workspace.name}</ThemedText>
                                                                    <ThemedText type="defaultSemiBold">{"→"}</ThemedText>
                                                                </View>
                                                            </View>
                                                        </TouchableOpacity>
                                                    </Skeleton>
                                                ))}
                                            </Skeleton.Group>
                                        </View>
                                    </ConditionalView>
                                    <TouchableOpacity
                                        onPress={() => setCreatingWorkspace(true)}
                                        style={[
                                            styles.createWorkspaceCard,
                                            {
                                                backgroundColor: ThemedColor.lightened,
                                            }
                                        ]}>
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
    workspacesGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 12,
        justifyContent: "space-between",
        width: "100%",
    },
    workspaceCard: {
        borderRadius: 12,
        padding: 16,
        aspectRatio: 1.36,
        justifyContent: "flex-end",
        width: (Dimensions.get("window").width - HORIZONTAL_PADDING * 2) / 2.1,
        borderWidth: 1,
    },
    workspaceCardContent: {
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 8,
        width: "100%",
    },
    workspaceCardText: {
        flexDirection: "row",
        justifyContent: "space-between",
        width: "100%",
    },
    createWorkspaceCard: {
        padding: 16,
        borderRadius: 12,
        width: "100%",
        alignItems: "center",
        marginTop: 12,
    },
});
