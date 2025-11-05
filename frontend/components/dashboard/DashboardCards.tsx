import { View, ScrollView, Dimensions } from "react-native";
import React from "react";
import DashboardCard from "../cards/DashboardCard";
import { useThemeColor } from "@/hooks/useThemeColor";
import { router } from "expo-router";
import { DrawerLayout } from "react-native-gesture-handler";
import TodaySection from "./TodaySection";
import { AttachStep } from "react-native-spotlight-tour";
import { Bird, BookBookmark, Calendar, ChartBar } from "phosphor-react-native";
import { HORIZONTAL_PADDING } from "@/constants/spacing";

type Props = {
    drawerRef?: React.RefObject<DrawerLayout>;
};

const DashboardCards = (props: Props) => {
    const ThemedColor = useThemeColor();

    const cards = [
        {
            title: "Daily View",
            icon: <Bird size={28} weight="light" color={ThemedColor.text} />,
            onPress: () => {
                router.push({
                    pathname: "/(logged-in)/(tabs)/(task)/daily",
                    params: { workspace: "Daily" },
                });
            },
        },
        {
            title: "Workspaces",
            icon: <BookBookmark size={28} weight="light" color={ThemedColor.text} />,
            onPress: () => {
                props.drawerRef?.current?.openDrawer();
            },
            attachStep: 0,
        },
        {
            title: "Calendar",
            icon: <Calendar size={28} weight="light" color={ThemedColor.text} />,
            onPress: () => {
                router.push({
                    pathname: "/(logged-in)/(tabs)/(task)/calendar",
                    params: { workspace: "Calendar" },
                });
            },
        },
        {
            title: "Analytics",
            icon: <ChartBar size={28} weight="light" color={ThemedColor.text} />,
            onPress: () => {
                router.push({
                    pathname: "/(logged-in)/(tabs)/(task)/analytics",
                    params: { workspace: "Analytics" },
                });
            },
        },
    ];

    return (
        <View style={{ flexDirection: "column", gap: 16, width: "100%"}}>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{
                    gap: 12,
                    paddingLeft: HORIZONTAL_PADDING,
                    paddingRight: HORIZONTAL_PADDING,
                }}
                style={{
                    marginLeft: -HORIZONTAL_PADDING,
                    marginRight: 0,
                }}
                bounces={false}
                decelerationRate="fast"
                directionalLockEnabled={true}
                canCancelContentTouches={true}
                scrollEventThrottle={16}
                alwaysBounceHorizontal={false}
                nestedScrollEnabled={true}>
                {cards.map((card, index) => {
                    const CardComponent = (
                        <DashboardCard key={card.title} title={card.title} icon={card.icon} onPress={card.onPress} />
                    );

                    if (card.attachStep !== undefined) {
                        return (
                            <AttachStep key={card.title} index={card.attachStep}>
                                {CardComponent}
                            </AttachStep>
                        );
                    }

                    return CardComponent;
                })}
            </ScrollView>

            <TodaySection />
        </View>
    );
};

export default DashboardCards;
