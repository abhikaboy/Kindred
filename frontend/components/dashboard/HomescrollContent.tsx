import React from "react";
import { ScrollView, View, Switch, TouchableOpacity, TextInput } from "react-native";
import { MotiView } from "moti";
import { ThemedText } from "@/components/ThemedText";
import { WorkspaceGrid } from "./WorkspaceGrid";
import DashboardCards from "@/components/dashboard/DashboardCards";
import BottomDashboardCards from "@/components/dashboard/BottomDashboardCards";
import TutorialCard from "@/components/cards/TutorialCard";
import BasicCard from "@/components/cards/BasicCard";
import { useRouter } from "expo-router";
import { KudosCards } from "../cards/KudosCard";
import { HorseIcon, PlusIcon } from "phosphor-react-native";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import TodaySection from "./TodaySection";
import Ionicons from "@expo/vector-icons/Ionicons";
interface HomeScrollContentProps {
    encouragementCount: number;
    congratulationCount: number;
    workspaces: any[];
    displayWorkspaces: any[];
    fetchingWorkspaces: boolean;
    onWorkspaceSelect: (workspaceName: string) => void;
    onCreateWorkspace: () => void;
    shouldShowTutorial: boolean;
    drawerRef: any;
    ThemedColor: any;
    focusMode: boolean;
    toggleFocusMode: () => void;
}

export const HomeScrollContent: React.FC<HomeScrollContentProps> = ({
    encouragementCount,
    congratulationCount,
    workspaces,
    displayWorkspaces,
    fetchingWorkspaces,
    onWorkspaceSelect,
    onCreateWorkspace,
    shouldShowTutorial,
    drawerRef,
    ThemedColor,
    focusMode,
    toggleFocusMode,
}) => {
    const router = useRouter();

    return (
        <ScrollView style={{ gap: 8 }} contentContainerStyle={{ gap: 8 }} showsVerticalScrollIndicator={false}>
            <MotiView style={{ gap: 8, marginTop: 12 }}>
                {/* Focus - always visible at the top */}
                {/* <BasicCard>
                    <View
                        style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            alignItems: "center",
                        }}>
                        <ThemedText type="default">Focus</ThemedText>
                        <Switch
                            value={focusMode}
                            onValueChange={toggleFocusMode}
                            trackColor={{
                                false: ThemedColor.caption + "40",
                                true: ThemedColor.primary,
                            }}
                            thumbColor={focusMode ? ThemedColor.tint : "#f4f3f4"}
                            ios_backgroundColor={ThemedColor.caption + "40"}
                        />
                    </View>
                </BasicCard> */}

                {/* Dashboard Cards */}
                <View style={{ marginLeft: HORIZONTAL_PADDING, gap: 12, marginBottom: 18 }}>
                    <ThemedText type="caption">JUMP BACK IN</ThemedText>
                    <DashboardCards drawerRef={drawerRef} />
                </View>

                {/* Kudos Cards (Encouragements & Congratulations) */}
                <View
                    style={{
                        marginHorizontal: HORIZONTAL_PADDING,
                        gap: 12,
                        marginBottom: 18,
                    }}>
                    <ThemedText type="caption">KUDOS</ThemedText>
                    <ThemedText type="caption">Send more Kudos to get rewards.</ThemedText>

                    <KudosCards />
                </View>

                <View style={{ marginHorizontal: HORIZONTAL_PADDING, gap: 12, marginBottom: 12, }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                        <ThemedText type="caption">UPCOMING</ThemedText>
                        <TouchableOpacity onPress={() => router.push("/(logged-in)/(tabs)/(task)/today")}>
                            <Ionicons name="chevron-forward" size={16} color={ThemedColor.caption} />
                        </TouchableOpacity>
                    </View>
                    <TodaySection />
                </View>
                {/* <View style={{ marginHorizontal: HORIZONTAL_PADDING, gap: 12, marginBottom: 12, }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                        <ThemedText type="caption">QUICK TASK</ThemedText>
                        <TouchableOpacity onPress={() => router.push("/(logged-in)/(tabs)/(task)/today")}>
                            <Ionicons name="add" size={16} color={ThemedColor.caption} />
                        </TouchableOpacity>
                    </View>
                    <TextInput placeholder="Whats on your mind?" style={{ backgroundColor: ThemedColor.lightened, borderRadius: 8, padding: 16, fontSize: 16, fontFamily: "OutfitLight" }} />
                </View> */}

                {/* Recent Workspaces Section */}
                <View
                    style={{
                        marginHorizontal: HORIZONTAL_PADDING,
                        gap: 16,
                    }}>
                    <View
                        style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            marginBottom: 2,
                        }}>
                        <ThemedText type="caption">RECENT WORKSPACES</ThemedText>
                        <TouchableOpacity onPress={onCreateWorkspace}>
                            <PlusIcon size="18" weight="light" color={ThemedColor.caption}></PlusIcon>
                        </TouchableOpacity>
                    </View>
                </View>

                <ScrollView
                    horizontal={false}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 108 }}>
                    <View
                        style={{
                            marginHorizontal: HORIZONTAL_PADDING,
                            gap: 16,
                            marginBottom: 18,
                        }}>
                        {/* Workspace Grid */}
                        <WorkspaceGrid
                            workspaces={workspaces}
                            displayWorkspaces={displayWorkspaces}
                            fetchingWorkspaces={fetchingWorkspaces}
                            onWorkspacePress={onWorkspaceSelect}
                            ThemedColor={ThemedColor}
                        />
                    </View>

                    {/* Tutorial Card */}
                    <View
                        style={{
                            marginLeft: HORIZONTAL_PADDING,
                            marginRight: HORIZONTAL_PADDING,
                        }}>
                        <TutorialCard
                            onPress={() => router.push("/(logged-in)/(tutorial)")}
                            showBadge={shouldShowTutorial}
                        />
                    </View>
                </ScrollView>
            </MotiView>
        </ScrollView>
    );
};
