import { Dimensions, StyleSheet, ScrollView, View } from "react-native";
import React, { useEffect } from "react";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import TaskCard from "@/components/cards/TaskCard";
import { useAuth } from "@/hooks/useAuth";
import { useRequest } from "@/hooks/useRequest";

type Props = {};

const Home = (props: Props) => {
    // get tasks via api call
    const { user } = useAuth();
    const { request } = useRequest();

    const [categories, setCategories] = React.useState<any[]>([]);

    const [time, setTime] = React.useState(new Date().toLocaleTimeString());
    const [timeOfDay, setTimeOfDay] = React.useState("Good Morning! ☀");

    const getTasks = async () => {
        let data = await request("GET", "/user/Categories/" + user._id);
        setCategories(data);
        console.log(data);
    };

    useEffect(() => {
        getTasks();
    }, []);

    useEffect(() => {
        setInterval(() => {
            setTime(new Date().toLocaleTimeString());
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
    return (
        <ThemedView style={{ flex: 1, paddingTop: Dimensions.get("screen").height * 0.12, paddingHorizontal: 24 }}>
            <View style={{ paddingBottom: 24 }}>
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
                        <View style={{ gap: 16 }} key={category._id}>
                            <ThemedText type="subtitle">{category.name}</ThemedText>
                            {category.tasks.map((task) => (
                                <TaskCard
                                    key={task._id}
                                    content={task.content}
                                    points={task.value}
                                    priority={task.priority}
                                />
                            ))}
                        </View>
                    ))}
                </View>
            </ScrollView>
        </ThemedView>
    );
};

export default Home;

const styles = StyleSheet.create({});
