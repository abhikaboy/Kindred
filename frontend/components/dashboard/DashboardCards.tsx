import { View } from "react-native";
import React from "react";
import DashboardCard from "../cards/DashboardCard";
import { useThemeColor } from "@/hooks/useThemeColor";
import { router } from "expo-router";
import { DrawerLayout } from "react-native-gesture-handler";
import TodaySection from "./TodaySection";
import { AttachStep } from "react-native-spotlight-tour";
import { BirdIcon, Book, BookBookmarkIcon } from "phosphor-react-native";
type Props = {
    drawerRef?: React.RefObject<DrawerLayout>;
};

const DashboardCards = (props: Props) => {
    const ThemedColor = useThemeColor();
    return (
        <View style={{ flexDirection: "column", gap: 16, width: "100%" }}>
            <View style={{ flexDirection: "row", gap: 16, width: "100%" }}>
                <DashboardCard
                    title="Daily View"
                    icon={<BirdIcon size="28" weight="light"></BirdIcon>}
                    onPress={() => {
                        router.push({
                            pathname: "/(logged-in)/(tabs)/(task)/daily",
                            params: { workspace: "Daily" },
                        });
                    }}
                />
                <AttachStep index={0}>
                    <DashboardCard
                        title="Workspaces"
                        icon={<BookBookmarkIcon size="28" weight="light"></BookBookmarkIcon>}
                        onPress={() => {
                            props.drawerRef?.current?.openDrawer();
                        }}
                    />
                </AttachStep>
            </View>

            <TodaySection />
        </View>
    );
};

export default DashboardCards;
