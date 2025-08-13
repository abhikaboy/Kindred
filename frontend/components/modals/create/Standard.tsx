import { Dimensions, Keyboard, StyleSheet, TextInput, TouchableOpacity, View } from "react-native";
import React, { useState } from "react";
import ThemedInput from "../../inputs/ThemedInput";
import Dropdown from "../../inputs/Dropdown";
import { useRequest } from "@/hooks/useRequest";
import { useTasks } from "@/contexts/tasksContext";
import { useTaskCreation } from "@/contexts/taskCreationContext";
import { Screen } from "../CreateModal";
import { ThemedText } from "@/components/ThemedText";
import TrafficLight from "@/components/inputs/TrafficLight";
import ThemedSlider from "@/components/inputs/ThemedSlider";
import ConditionalView from "@/components/ui/ConditionalView";
import AdvancedOption from "./AdvancedOption";
import { useThemeColor } from "@/hooks/useThemeColor";
import Feather from "@expo/vector-icons/Feather";
import Popover from "react-native-popover-view";
import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import { CreateTaskParams } from "@/api/task";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";

type Props = {
    hide: () => void;
    goTo: (screen: Screen) => void;
};

const Standard = ({ hide, goTo }: Props) => {
    const nameRef = React.useRef<TextInput>(null);
    const { request } = useRequest();
    const { categories, addToCategory, selectedCategory, setCreateCategory } = useTasks();
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
        deadline,
        startTime,
        startDate,
        reminders,
        isPublic,
        resetTaskCreation,
    } = useTaskCreation();
    const ThemedColor = useThemeColor();
    const createPost = async () => {
        console.log("🔍 CLIENT BASE URL:", process.env.EXPO_PUBLIC_URL);
        console.log("🔍 ABOUT TO CALL:", `${process.env.EXPO_PUBLIC_URL}/v1/user/posts`);
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
        if (categories.filter((c) => c.name !== "!-proxy-!").length == 0) {
            goTo(Screen.NEW_CATEGORY);
        }
    } else {
        console.warn("Categories is null " + categories);
    }

    return (
        <View style={{ gap: 8, flexDirection: "column", display: "flex" }} onTouchStart={() => Keyboard.dismiss()}>
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ flexDirection: "row", gap: 16, alignItems: "center" }}></View>
            </View>
            {suggestion && (
                <View style={{ flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
                    <ThemedText type="default" style={{ fontSize: 16 }}>
                        Suggested: {suggestion}
                    </ThemedText>
                </View>
            )}
            <View
                style={{
                    flexDirection: "row",
                    flex: 1,
                    justifyContent: "space-between",
                    width: "100%",
                    height: "auto",
                    minHeight: 55,
                    gap: 8,
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
                    ghost
                    selected={selectedCategory}
                    setSelected={setCreateCategory}
                    onSpecial={() => {
                        goTo(Screen.NEW_CATEGORY);
                    }}
                    width="76%"
                />
                <TouchableOpacity
                    style={{
                        borderRadius: 12,
                        padding: 12,
                        alignItems: "center",
                        justifyContent: "center",
                        borderWidth: 1,
                        borderColor: ThemedColor.tertiary,
                    }}
                    onPress={() => {
                        createPost();
                        hide();
                    }}>
                    <ThemedText type="caption">Create</ThemedText>
                </TouchableOpacity>
            </View>
            <ThemedInput
                ghost
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
                textStyle={{
                    fontSize: 24,
                    fontFamily: "Outfit",
                    fontWeight: 500,
                    letterSpacing: -0.2,
                }}
            />
            <PrimaryOptionRow />
            <AdvancedOptionList goTo={goTo} showUnconfigured={false} />
            <TouchableOpacity
                onPress={() => {
                    setShowAdvanced(!showAdvanced);
                }}
                style={{
                    flexDirection: "row",
                    gap: 16,
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingVertical: 8,
                    paddingTop: 16,
                }}>
                <ThemedText type="lightBody">Advanced Options</ThemedText>
                <Feather name={showAdvanced ? "chevron-up" : "chevron-down"} size={20} color={ThemedColor.text} />
            </TouchableOpacity>
            <ConditionalView condition={showAdvanced}>
                <AdvancedOptionList goTo={goTo} showUnconfigured={true} />
            </ConditionalView>
        </View>
    );
};

export default Standard;

const styles = StyleSheet.create({});

const PrimaryOptionRow = () => {
    const ThemedColor = useThemeColor();
    const [showPriority, setShowPriority] = useState(false);
    const { priority, setPriority, value, setValue, isPublic, setIsPublic } = useTaskCreation();
    return (
        <View
            style={{
                flexDirection: "row",
                gap: 8,
                alignItems: "center",
                marginTop: Dimensions.get("screen").height * 0.05,
            }}>
            <PriorityPicker
                showPriority={showPriority}
                setShowPriority={setShowPriority}
                priority={priority}
                setPriority={setPriority}
            />
            <DifficultyPopover value={value} setValue={setValue} />
            <TouchableOpacity
                onPress={() => {
                    setIsPublic(!isPublic);
                }}
                style={{
                    backgroundColor: ThemedColor.background,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: ThemedColor.tertiary,
                    padding: 12,
                    flexDirection: "row",
                    gap: 4,
                    alignItems: "center",
                    justifyContent: "center",
                }}>
                <Feather name={isPublic ? "eye" : "eye-off"} size={20} color={ThemedColor.text} />
                <ThemedText type="lightBody">{isPublic ? "Public" : "Private"}</ThemedText>
            </TouchableOpacity>
        </View>
    );
};

const PriorityPicker = ({
    showPriority,
    setShowPriority,
    priority,
    setPriority,
}: {
    showPriority: boolean;
    setShowPriority: (value: boolean) => void;
    priority: number;
    setPriority: (value: number) => void;
}) => {
    const ICON_SIZE = 20;
    const ThemedColor = useThemeColor();

    const priorityMapping = {
        0: ThemedColor.tertiary,
        1: ThemedColor.success,
        2: ThemedColor.warning,
        3: ThemedColor.error,
        4: ThemedColor.error,
    };

    return (
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
                        backgroundColor: ThemedColor.background,
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: ThemedColor.tertiary,
                        flexDirection: "row",
                        gap: 4,
                        padding: 12,
                    }}>
                    <Feather name="flag" size={ICON_SIZE} color={priorityMapping[priority]} />
                    <ThemedText type="lightBody" style={{ fontSize: 16 }}>
                        Priority
                    </ThemedText>
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
            <View style={{ padding: 12 }}>
                <TrafficLight
                    setValue={(value) => {
                        setPriority(value);
                        setShowPriority(false);
                    }}
                    value={priority}
                />
            </View>
        </Popover>
    );
};

const DifficultyPopover = ({ value, setValue }: { value: number; setValue: (value: number) => void }) => {
    const [showDifficulty, setShowDifficulty] = React.useState(false);
    const ICON_SIZE = 20;
    const ThemedColor = useThemeColor();
    return (
        <Popover
            popoverStyle={{
                backgroundColor: ThemedColor.background,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: ThemedColor.tertiary,
                width: Dimensions.get("window").width * 0.8,
                padding: 16,
                alignItems: "center",
            }}
            isVisible={showDifficulty}
            onRequestClose={() => setShowDifficulty(false)}
            from={
                <TouchableOpacity
                    onPress={() => setShowDifficulty(true)}
                    style={{
                        backgroundColor: ThemedColor.background,
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: ThemedColor.tertiary,
                        flexDirection: "row",
                        gap: 4,
                        padding: 12,
                    }}>
                    <FontAwesome6 name="dumbbell" size={ICON_SIZE} color={ThemedColor.primary} />
                    <ThemedText type="lightBody" style={{ fontSize: 16 }}>
                        Difficulty
                    </ThemedText>
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
                Difficulty: Level {value}
            </ThemedText>
            <ThemedSlider setStep={setValue} width={0.7} />
        </Popover>
    );
};

const AdvancedOptionList = ({
    goTo,
    showUnconfigured,
}: {
    goTo: (screen: Screen) => void;
    showUnconfigured: boolean;
}) => {
    const { startDate, startTime, deadline, reminders, recurring, recurFrequency } = useTaskCreation();
    return (
        <View style={{ gap: 12, marginTop: 4 }}>
            <AdvancedOption
                icon="calendar"
                label={startDate ? "Start Date: " + startDate.toLocaleDateString() : "Set Start Date"}
                screen={Screen.STARTDATE}
                goTo={goTo}
                showUnconfigured={showUnconfigured}
                configured={startDate !== null}
            />
            <AdvancedOption
                icon="time"
                label={startTime ? "Start Time: " + startTime.toLocaleTimeString() : "Set Start Time"}
                screen={Screen.STARTTIME}
                goTo={goTo}
                showUnconfigured={showUnconfigured}
                configured={startTime !== null}
            />
            <AdvancedOption
                icon="flag"
                label={deadline ? "Deadline: " + deadline.toLocaleString() : "Set Deadline"}
                screen={Screen.DEADLINE}
                goTo={goTo}
                showUnconfigured={showUnconfigured}
                configured={deadline !== null}
            />
            <AdvancedOption
                icon="repeat"
                label={recurring ? "Recurring: " + recurFrequency : "Make Recurring"}
                screen={Screen.RECURRING}
                goTo={goTo}
                showUnconfigured={showUnconfigured}
                configured={reminders.length > 0}
            />
            <AdvancedOption
                icon="alarm"
                label={reminders.length > 0 ? "Reminders: " + reminders.length : "Add Reminder"}
                screen={Screen.REMINDER}
                goTo={goTo}
                showUnconfigured={showUnconfigured}
                configured={recurring}
            />
            <AdvancedOption
                icon="people"
                label="Add Collaborators"
                screen={Screen.COLLABORATORS}
                goTo={goTo}
                showUnconfigured={showUnconfigured}
                configured={false}
            />
        </View>
    );
};
