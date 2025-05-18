import { Keyboard, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import React from "react";
import ThemedInput from "../../inputs/ThemedInput";
import Dropdown from "../../inputs/Dropdown";
import { useRequest } from "@/hooks/useRequest";
import { useTasks } from "@/contexts/tasksContext";
import { useTaskCreation } from "@/contexts/taskCreationContext";
import { Screen } from "../CreateModal";
import { ThemedText } from "@/components/ThemedText";
import SelectedIndicator from "@/components/SelectedIndicator";
import TrafficLight from "@/components/inputs/TrafficLight";
import ThemedSlider from "@/components/inputs/ThemedSlider";
import ThemedSwitch from "@/components/inputs/ThemedSwitch";
import Ionicons from "@expo/vector-icons/Ionicons";
import ConditionalView from "@/components/ui/ConditionalView";
import AdvancedOption from "./AdvancedOption";

type Props = {
    hide: () => void;
    goTo: (screen: Screen) => void;
};

const Standard = ({ hide, goTo }: Props) => {
    const nameRef = React.useRef<TextInput>(null);
    const { request } = useRequest();
    const { categories, addToCategory, selectedCategory, setCreateCategory } = useTasks();
    const { taskName, setTaskName, showAdvanced, setShowAdvanced } = useTaskCreation();

    console.log("Selected Category:" + selectedCategory);

    const createPost = async () => {
        if (categories.length === 0) return;
        const response = await request("POST", `/user/tasks/${selectedCategory.id}`, {
            priority: 1,
            content: taskName,
            value: 3,
            recurring: false,
            public: true,
            active: false,
            checklist: [],
            notes: "",
            startDate: new Date(),
        });

        addToCategory(selectedCategory.id, response);
    };

    if (categories) {
        if (categories.length == 1) {
            goTo(Screen.NEW_CATEGORY);
        }
    } else {
        console.warn("Categories is null " + categories);
    }

    return (
        <View style={{ gap: 16, flexDirection: "column", display: "flex" }} onTouchStart={() => Keyboard.dismiss()}>
            <ThemedInput
                autofocus={taskName.length === 0}
                ref={nameRef}
                placeHolder="Enter the Task Name"
                onSubmit={() => {
                    createPost();
                    hide();
                }}
                onBlur={() => {
                    nameRef.current?.blur();
                    Keyboard.dismiss();
                }}
                onChangeText={(text) => {
                    setTaskName(text);
                }}
                value={taskName}
                setValue={setTaskName}
            />
            <Dropdown
                options={[
                    ...categories
                        .filter((c) => c.name !== "!-proxy-!")
                        .map((c) => {
                            return { label: c.name, id: c.id, special: false };
                        }),
                    { label: "+ New Category", id: "", special: true },
                ]}
                selected={selectedCategory}
                setSelected={setCreateCategory}
                onSpecial={() => {
                    goTo(Screen.NEW_CATEGORY);
                }}
            />
            <View style={{ gap: 8 }}>
                <ThemedText type="lightBody">Priority</ThemedText>
                <View style={{ flexDirection: "row", gap: 16 }}>
                    <TrafficLight />
                </View>
            </View>
            <View style={{ gap: 16 }}>
                <ThemedText type="lightBody">Difficulty</ThemedText>
                <ThemedSlider />
            </View>
            <View style={{ flexDirection: "row", gap: 16, alignItems: "center" }}>
                <ThemedSwitch />
                <ThemedText type="lightBody">Edit Visibility</ThemedText>
            </View>

            <TouchableOpacity
                style={{ flexDirection: "row", gap: 16, alignItems: "center", justifyContent: "space-between" }}
                onPress={() => setShowAdvanced(!showAdvanced)}>
                <ThemedText type="lightBody">Advanced Options</ThemedText>
                <Ionicons name={showAdvanced ? "chevron-down" : "chevron-up"} size={24} color="white" />
            </TouchableOpacity>
            <ConditionalView condition={showAdvanced}>
                <View style={{ gap: 16, marginTop: 4 }}>
                    <AdvancedOption icon="calendar" label="Set Start Date" screen={Screen.STARTDATE} goTo={goTo} />
                    <AdvancedOption icon="time" label="Set Start Time" screen={Screen.STARTTIME} goTo={goTo} />
                    <AdvancedOption icon="calendar" label="Set Deadline" screen={Screen.DEADLINE} goTo={goTo} />
                    <AdvancedOption icon="repeat" label="Make Recurring" screen={Screen.RECURRING} goTo={goTo} />
                    <AdvancedOption icon="alarm" label="Add Reminder" screen={Screen.REMINDER} goTo={goTo} />
                    <AdvancedOption icon="people" label="Add Collaborators" screen={Screen.COLLABORATORS} goTo={goTo} />
                </View>
            </ConditionalView>
        </View>
    );
};

export default Standard;

const styles = StyleSheet.create({});
