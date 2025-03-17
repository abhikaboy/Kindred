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
import ThemedColor from "@/constants/Colors";

import ReanimatedDrawerLayout, {
    DrawerType,
    DrawerPosition,
    DrawerLayoutMethods,
} from "react-native-gesture-handler/ReanimatedDrawerLayout";
import CreateModal from "@/components/modals/CreateModal";

type Props = {};

const Home = (props: Props) => {
    // get tasks via api call
    const { user } = useAuth();
    const { request } = useRequest();

    const { categories, fetchWorkspaces } = useTasks();

    const [time, setTime] = React.useState(new Date().toLocaleTimeString());
    const [timeOfDay, setTimeOfDay] = React.useState("Good Morning! ☀");
    const [creating, setCreating] = React.useState(false);

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
            <ThemedView
                style={{
                    flex: 1,
                    paddingTop: Dimensions.get("screen").height * 0.1,
                    paddingHorizontal: 24,
                    paddingBottom: Dimensions.get("screen").height * 0.12,
                }}>
                <TouchableOpacity onPress={() => drawerRef.current?.openDrawer()}>
                    <Feather name="menu" size={32} color="white" />
                </TouchableOpacity>
                <View style={{ paddingBottom: 24, paddingTop: 20 }}>
                    <ThemedText type="title" style={{ fontWeight: 700 }}>
                        {timeOfDay}
                    </ThemedText>
                    <ThemedText type="lightBody">{time} </ThemedText>
                    <ThemedText type="lightBody">
                        Treat yourself to a cup of coffee and a good book. You deserve it.
                    </ThemedText>
                </View>
                <ScrollView>
                    <View style={{ gap: 16, marginTop: 0 }}>
                        {categories.map((category) => (
                            <View style={{ gap: 16 }} key={category.id + category.name}>
                                <ThemedText type="subtitle">{category.name}</ThemedText>
                                {category.tasks.map((task) => (
                                    <TaskCard
                                        key={task.id + task.content}
                                        content={task.content}
                                        points={task.value}
                                        priority={task.priority}
                                        redirect={true}
                                        id={task.id}
                                        categoryId={category.id}
                                    />
                                ))}
                            </View>
                        ))}
                        <TouchableOpacity
                            onPress={() => setCreating(true)}
                            style={{
                                alignItems: "center",
                                justifyContent: "center",
                                width: "100%",
                                paddingVertical: 12,
                                borderRadius: 12,
                                backgroundColor: ThemedColor.lightened,
                            }}>
                            <ThemedText type="defaultSemiBold">+</ThemedText>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </ThemedView>
        </ReanimatedDrawerLayout>
    );
};

export default Home;
const styles = StyleSheet.create({});
