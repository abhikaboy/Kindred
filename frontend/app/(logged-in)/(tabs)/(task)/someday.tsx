import { Dimensions, StyleSheet, View, TouchableOpacity } from "react-native";
import React, { useRef } from "react";
import Feather from "@expo/vector-icons/Feather";
import { DrawerLayout } from "react-native-gesture-handler";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { Drawer } from "@/components/home/Drawer";
import { useThemeColor } from "@/hooks/useThemeColor";
import { DRAWER_WIDTH, HORIZONTAL_PADDING } from "@/constants/spacing";
import { useDrawer } from "@/contexts/drawerContext";
import { SomedayList } from "@/components/task/SomedayList";

const Someday = () => {
    const ThemedColor = useThemeColor();
    const drawerRef = useRef<any>(null);
    const { setIsDrawerOpen } = useDrawer();

    return (
        <DrawerLayout
            ref={drawerRef}
            hideStatusBar
            edgeWidth={50}
            drawerWidth={DRAWER_WIDTH}
            renderNavigationView={() => <Drawer close={drawerRef.current?.closeDrawer} />}
            drawerPosition="left"
            drawerType="front"
            onDrawerOpen={() => setIsDrawerOpen(true)}
            onDrawerClose={() => setIsDrawerOpen(false)}>
            <ThemedView style={styles.container}>
                <TouchableOpacity onPress={() => drawerRef.current?.openDrawer()}>
                    <Feather name="menu" size={24} color={ThemedColor.caption} />
                </TouchableOpacity>

                <View style={styles.header}>
                    <ThemedText type="title" style={styles.title}>
                        Someday
                    </ThemedText>
                </View>

                <SomedayList />
            </ThemedView>
        </DrawerLayout>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: Dimensions.get("screen").height * 0.09,
        paddingHorizontal: HORIZONTAL_PADDING,
    },
    header: {
        paddingTop: 20,
        paddingBottom: 24,
    },
    title: {
        fontWeight: "600",
    },
});

export default Someday;
