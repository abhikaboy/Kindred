import React from "react";
import { ScrollView, View, Switch } from "react-native";
import { MotiView } from "moti";
import { ThemedText } from "@/components/ThemedText";
import { WorkspaceGrid } from "./WorkspaceGrid";
import DashboardCards from "@/components/dashboard/DashboardCards";
import BottomDashboardCards from "@/components/dashboard/BottomDashboardCards";
import TutorialCard from "@/components/cards/TutorialCard";
import BasicCard from "@/components/cards/BasicCard";
import { useRouter } from "expo-router";
import { KudosCards } from "../cards/KudosCard";

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
            <MotiView style={{ gap: 8, marginTop: 20 }}>
                {/* Focus - always visible at the top */}
                <BasicCard>
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
                </BasicCard>

                {/* Kudos Cards (Encouragements & Congratulations) */}
                <KudosCards
                    encouragementCount={encouragementCount}
                    congratulationCount={congratulationCount}
                    ThemedColor={ThemedColor}
                />

                {/* Dashboard Cards */}
                <DashboardCards drawerRef={drawerRef} />

                {/* Recent Workspaces Section */}
                <ThemedText type="default">Recent Workspaces</ThemedText>

                <ScrollView
                    horizontal={false}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 108 }}>
                    {/* Workspace Grid */}
                    <WorkspaceGrid
                        workspaces={workspaces}
                        displayWorkspaces={displayWorkspaces}
                        fetchingWorkspaces={fetchingWorkspaces}
                        onWorkspacePress={onWorkspaceSelect}
                        onCreatePress={onCreateWorkspace}
                        ThemedColor={ThemedColor}
                    />

                    {/* Bottom Dashboard Cards */}
                    <View style={{ paddingBottom: 64, paddingTop: 16 }}>
                        <BottomDashboardCards />
                    </View>

                    {/* Tutorial Card */}
                    <TutorialCard
                        onPress={() => router.push("/(logged-in)/(tutorial)")}
                        showBadge={shouldShowTutorial}
                    />
                </ScrollView>
            </MotiView>
        </ScrollView>
    );
};
