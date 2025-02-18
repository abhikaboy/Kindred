import { Dimensions, StyleSheet, ScrollView, View } from "react-native";
import React, { useEffect } from "react";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import TaskCard from "@/components/cards/TaskCard";

type Props = {};

const Home = (props: Props) => {
    const [time, setTime] = React.useState(new Date().toLocaleTimeString());
    const [timeOfDay, setTimeOfDay] = React.useState("Good Morning! ☀");
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
                    <ThemedText type="subtitle">Household</ThemedText>
                    <TaskCard content={"do my hw lol"} points={9} priority="high" />
                    <TaskCard content={"do my hw lol"} points={9} priority="low" />
                    <ThemedText type="subtitle">Personal</ThemedText>
                    <TaskCard content={"cook lunch"} points={9} priority="high" />
                    <ThemedText type="subtitle">Human Computer Interaction</ThemedText>
                    <TaskCard content={"Weekly Reading Assignment"} points={9} priority="high" />
                    <TaskCard content={"HW3 - Contextual Inquiry"} points={9} priority="medium" />
                </View>
            </ScrollView>
        </ThemedView>
    );
};

export default Home;

const styles = StyleSheet.create({});
