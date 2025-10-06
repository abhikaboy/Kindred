import { Dimensions, StyleSheet, ScrollView, View, TouchableOpacity } from "react-native";
import React, { useRef, useState } from "react";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useTasks } from "@/contexts/tasksContext";
import Feather from "@expo/vector-icons/Feather";
import { Drawer } from "@/components/home/Drawer";
import { DrawerLayout } from "react-native-gesture-handler";
import EditCategory from "@/components/modals/edit/EditCategory";
import { useCreateModal } from "@/contexts/createModalContext";
import { useThemeColor } from "@/hooks/useThemeColor";
import { Category } from "../../../../components/category";
import ConfettiCannon from "react-native-confetti-cannon";
import ConditionalView from "@/components/ui/ConditionalView";
import SlidingText from "@/components/ui/SlidingText";
import Ionicons from "@expo/vector-icons/Ionicons";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import DefaultModal from "@/components/modals/DefaultModal";
import ReorderCategories from "@/components/modals/ReorderCategories";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDrawer } from "@/contexts/drawerContext";

type Props = {};

const Workspace = (props: Props) => {
    let ThemedColor = useThemeColor();
    const { categories, selected, showConfetti } = useTasks();
    const insets = useSafeAreaInsets();
    const { openModal } = useCreateModal();

    const [editing, setEditing] = useState(false);
    const [reordering, setReordering] = useState(false);
    const [focusedCategory, setFocusedCategory] = useState<string>("");
    const [isHeaderSticky, setIsHeaderSticky] = useState(false);

    const drawerRef = useRef<DrawerLayout>(null);
    const scrollViewRef = useRef<ScrollView>(null);
    const noCategories = categories.filter((category) => category.name !== "!-proxy-!").length == 0;
    const { setIsDrawerOpen } = useDrawer();

    const handleScroll = (event: any) => {
        const scrollY = event.nativeEvent.contentOffset.y;
        // Adjust this threshold based on when you want the header to become sticky
        const stickyThreshold = 100; // Adjust this value as needed
        setIsHeaderSticky(scrollY > stickyThreshold);
    };

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
            <ConditionalView condition={showConfetti}>
                <View
                    style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        zIndex: 10,
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
            <EditCategory editing={editing} setEditing={setEditing} id={focusedCategory} />
            <DefaultModal visible={reordering} setVisible={setReordering}>
                <ReorderCategories hide={() => setReordering(false)} />
            </DefaultModal>

            {/* Sticky Header - Only shows when scrolled */}
            <ConditionalView condition={isHeaderSticky && selected !== ""}>
                <View
                    style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        zIndex: 1000,
                        backgroundColor: ThemedColor.background,
                        paddingHorizontal: HORIZONTAL_PADDING,
                        paddingTop: insets.top,
                        paddingBottom: 16,
                        borderBottomWidth: 1,
                        borderBottomColor: ThemedColor.lightened,
                    }}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                        <SlidingText type="title" style={styles.title}>
                            {selected}
                        </SlidingText>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
                            <TouchableOpacity onPress={() => setReordering(true)}>
                                <Ionicons name="chevron-expand-outline" size={28} color={ThemedColor.text} />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </ConditionalView>

            <ThemedView style={{ flex: 1 }}>
                {/* Scrollable Content */}
                <ScrollView
                    ref={scrollViewRef}
                    style={{ flex: 1 }}
                    showsVerticalScrollIndicator={false}
                    onScroll={handleScroll}
                    scrollEventThrottle={16}
                    contentContainerStyle={{ paddingBottom: Dimensions.get("screen").height * 0.12 }}>
                    {/* Header Section - Scrolls with content initially */}
                    <View style={{ paddingHorizontal: HORIZONTAL_PADDING, paddingTop: insets.top }}>
                        <TouchableOpacity onPress={() => drawerRef.current?.openDrawer()}>
                            <Feather name="menu" size={24} color={ThemedColor.caption} />
                        </TouchableOpacity>

                        <ConditionalView condition={selected !== ""} animated={true} triggerDep={selected}>
                            <View style={styles.headerContainer}>
                                <View
                                    style={{
                                        flexDirection: "row",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        paddingBottom: 16,
                                    }}>
                                    <SlidingText type="title" style={styles.title}>
                                        {selected || "Good Morning! ☀"}
                                    </SlidingText>
                                    <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
                                        <TouchableOpacity onPress={() => setReordering(true)}>
                                            <Ionicons
                                                name="chevron-expand-outline"
                                                size={28}
                                                color={ThemedColor.text}
                                            />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                                <ThemedText type="lightBody">
                                    Treat yourself to a cup of coffee and a good book. You deserve it.
                                </ThemedText>
                            </View>
                        </ConditionalView>
                    </View>

                    {/* Content */}
                    <View style={{ paddingHorizontal: HORIZONTAL_PADDING }}>
                        <ConditionalView
                            condition={selected !== "" && noCategories}
                            animated={true}
                            triggerDep={selected}
                            style={{ height: "100%", marginTop: 8 }}>
                            <View style={{ flex: 1, alignItems: "flex-start", gap: 16, marginTop: 8 }}>
                                <ThemedText type="lightBody">This workspace is empty!</ThemedText>
                                <TouchableOpacity
                                    onPress={() => openModal()}
                                    style={[styles.addButton, { backgroundColor: ThemedColor.lightened }]}>
                                    <ThemedText type="defaultSemiBold">+</ThemedText>
                                </TouchableOpacity>
                            </View>
                        </ConditionalView>

                        <ConditionalView
                            condition={selected !== "" && !noCategories}
                            animated={true}
                            triggerDep={selected}>
                            <View style={styles.categoriesContainer} key="cateogry-container">
                                {categories
                                    .sort((a, b) => b.tasks.length - a.tasks.length)
                                    .filter((category) => category.name !== "!-proxy-!")
                                    .map((category) => {
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
                                                    openModal();
                                                    setFocusedCategory(categoryId);
                                                }}
                                            />
                                        );
                                    })}
                                <TouchableOpacity
                                    onPress={() => openModal()}
                                    style={[styles.addButton, { backgroundColor: ThemedColor.lightened }]}>
                                    <ThemedText type="defaultSemiBold">+</ThemedText>
                                </TouchableOpacity>
                            </View>
                        </ConditionalView>
                    </View>
                </ScrollView>
            </ThemedView>
        </DrawerLayout>
    );
};

export default Workspace;

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
