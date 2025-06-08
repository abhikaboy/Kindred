import { Dimensions, Keyboard, StyleSheet, Text, TextInput, Touchable, TouchableOpacity, View } from "react-native";
import React, { useState } from "react";
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
import { useSharedValue } from "react-native-reanimated";
import { useThemeColor } from "@/hooks/useThemeColor";
import Entypo from "@expo/vector-icons/Entypo";
import Octicons from "@expo/vector-icons/Octicons";
import AntDesign from "@expo/vector-icons/AntDesign";
import Feather from "@expo/vector-icons/Feather";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import Popover from "react-native-popover-view";
import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import { CreateTaskParams } from "@/api/task";
import { formatLocalDate, formatLocalTime, formatLocalDateTime } from "@/utils/timeUtils";

type Props = {
    hide: () => void;
    goTo: (screen: Screen) => void;
    bottomAnchorRef: React.RefObject<View>;
};

const Standard = ({ hide, goTo, bottomAnchorRef }: Props) => {
    const nameRef = React.useRef<TextInput>(null);
    const { request } = useRequest();
    const { categories, addToCategory, selectedCategory, setCreateCategory } = useTasks();
    const [showPriority, setShowPriority] = useState(false);
    const {
        taskName,
        setTaskName,
        showAdvanced,
        setShowAdvanced,
        suggestion,
        priority,
        value,
        recurring,
        recurFrequency,
        recurDetails,
        setPriority,
        deadline,
        startTime,
        startDate,
        reminders,
        isPublic,
        setIsPublic,
        setValue,
        resetTaskCreation,
    } = useTaskCreation();
    const ThemedColor = useThemeColor();
    const createPost = async () => {
        if (categories.length === 0) return;
        let postBody: CreateTaskParams = {
            content: taskName,
            priority: priority,
            value: value,
            recurring: recurring,
            public: isPublic,
            active: false,
            checklist: [],
            notes: "", // TODO: Add notes
            startDate: startDate?.toISOString(),
            startTime: startTime?.toISOString(),
            deadline: deadline?.toISOString(),
            reminders: reminders,
        };
        if (recurring) {
            postBody.recurFrequency = recurFrequency;
            postBody.recurDetails = recurDetails as RecurDetails;
        }
        console.log(postBody);
        const response = await request("POST", `/user/tasks/${selectedCategory.id}`, postBody);

        addToCategory(selectedCategory.id, response);
        resetTaskCreation();
    };

    if (categories) {
        if (categories.length == 1) {
            goTo(Screen.NEW_CATEGORY);
        }
    } else {
        console.warn("Categories is null " + categories);
    }

    return (
        <View style={{ gap: 8, flexDirection: "column", display: "flex" }} onTouchStart={() => Keyboard.dismiss()}>
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
                <ThemedText type="defaultSemiBold" style={{ fontSize: 20 }}>
                    New Task
                </ThemedText>
                <View style={{ flexDirection: "row", gap: 16, alignItems: "center" }}>
                    <TouchableOpacity onPress={() => setIsPublic(!isPublic)}>
                        <Feather name={isPublic ? "eye" : "eye-off"} size={24} color={ThemedColor.text} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => {
                            createPost();
                            hide();
                        }}>
                        <Feather name="plus" size={24} color={ThemedColor.text} />
                    </TouchableOpacity>
                </View>
            </View>
            {suggestion && (
                <View style={{ flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
                    <ThemedText type="default" style={{ fontSize: 16 }}>
                        Suggested: {suggestion}
                    </ThemedText>
                </View>
            )}

            <ThemedInput
                autofocus={taskName.length === 0}
                ref={nameRef as React.Ref<React.ElementRef<typeof BottomSheetTextInput>>}
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
            <View
                style={{
                    flexDirection: "row",
                    flex: 1,
                    justifyContent: "space-between",
                    width: "100%",
                    height: "auto",
                    minHeight: 55,
                    zIndex: 1000,
                }}>
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
                <Popover
                    popoverStyle={{
                        backgroundColor: ThemedColor.background,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: ThemedColor.tertiary,
                        width: Dimensions.get("window").width * 0.4,
                        padding: 12,
                    }}
                    isVisible={showPriority}
                    onRequestClose={() => {
                        setShowPriority(false);
                    }}
                    from={
                        <TouchableOpacity
                            onPress={() => {
                                setShowPriority(true);
                            }}
                            style={{
                                width: Dimensions.get("window").width * 0.15,
                                backgroundColor: ThemedColor.background,
                                height: "100%",
                                alignItems: "center",
                                justifyContent: "center",
                                borderRadius: 12,
                                borderWidth: 1,
                                borderColor: ThemedColor.tertiary,
                            }}>
                            {priority === 0 ? (
                                <Feather name="flag" size={24} color={ThemedColor.text} />
                            ) : priority === 1 ? (
                                <Feather name="flag" size={24} color={ThemedColor.success} />
                            ) : priority === 2 ? (
                                <Feather name="flag" size={24} color={ThemedColor.warning} />
                            ) : priority === 3 ? (
                                <Feather name="flag" size={24} color={ThemedColor.error} />
                            ) : priority === 4 ? (
                                <Feather name="flag" size={24} color={ThemedColor.error} />
                            ) : (
                                <Feather name="flag" size={24} color={ThemedColor.tertiary} />
                            )}
                        </TouchableOpacity>
                    }>
                    <ThemedText
                        type="defaultSemiBold"
                        style={{
                            padding: 12,
                            textAlign: "left",
                            fontWeight: 500,
                            fontSize: 20,
                        }}>
                        Priority
                    </ThemedText>
                    <TrafficLight
                        setValue={(value) => {
                            setPriority(value);
                            setShowPriority(false);
                        }}
                        value={priority}
                    />
                </Popover>
            </View>

            <View style={{ flexDirection: "column", marginVertical: 4, gap: 16, marginTop: 16 }} ref={bottomAnchorRef}>
                <ThemedText type="lightBody">Difficulty: Level {value}</ThemedText>
                <ThemedSlider setStep={setValue} />
            </View>

            <TouchableOpacity
                style={{
                    flexDirection: "row",
                    gap: 16,
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginVertical: 4,
                    marginTop: 16,
                }}>
                <ThemedText type="lightBody">Timing</ThemedText>
            </TouchableOpacity>
            <ConditionalView condition={true}>
                <View style={{ gap: 12, marginTop: 4 }}>
                    <AdvancedOption
                        icon="calendar"
                        label={startDate ? "Start Date: " + startDate.toLocaleDateString() : "Set Start Date"}
                        screen={Screen.STARTDATE}
                        goTo={goTo}
                    />
                    <AdvancedOption
                        icon="time"
                        label={startTime ? "Start Time: " + startTime.toLocaleTimeString() : "Set Start Time"}
                        screen={Screen.STARTTIME}
                        goTo={goTo}
                    />
                    <AdvancedOption
                        icon="flag"
                        label={deadline ? "Deadline: " + deadline.toLocaleString() : "Set Deadline"}
                        screen={Screen.DEADLINE}
                        goTo={goTo}
                    />
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
