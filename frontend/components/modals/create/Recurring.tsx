import { Dimensions, View } from "react-native";
import React, { useEffect, useState } from "react";
import { ThemedText } from "@/components/ThemedText";
import Feather from "@expo/vector-icons/Feather";
import { TouchableOpacity } from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { Picker } from "@react-native-picker/picker";
import Dropdown from "@/components/inputs/Dropdown";
import { ScrollView } from "react-native";
import { useTaskCreation } from "@/contexts/taskCreationContext";

type Option = {
    label: string;
    id: string;
    special?: boolean;
};

type Props = {
    goToStandard: () => void;
};

const Recurring = ({ goToStandard }: Props) => {
    const ThemedColor = useThemeColor();
    const [mode, setMode] = useState<"start" | "deadline">("start");
    const [frequency, setFrequency] = useState<"day" | "week" | "month" | "year">("day");
    const [frequencyAmount, setFrequencyAmount] = useState<number>(1);
    const { startDate, startTime, deadline } = useTaskCreation();
    const [quickOptions, setQuickOptions] = useState<Option[]>([{ label: "Daily", id: "daily" }]);
    const [selectedQuickOption, setSelectedQuickOption] = useState<Option>(quickOptions[0]);

    useEffect(() => {
        let timeInQuestion = startDate && startTime ? startTime : deadline;
        if (!timeInQuestion) return;
        let options = [{ label: "Daily", id: "daily" }];
        if (mode === "start") {
            if (startDate && startTime) {
                options.push({ label: "Every Weekday", id: "weekday" });
            }
        }
        if (mode === "deadline") {
            if (deadline) {
                options.push({ label: "Every Weekday", id: "weekday" });
            }
        }
        setQuickOptions(options);
    }, [startDate, startTime, deadline]);

    const frequencyLimits = {
        day: {
            min: 1,
            max: 365,
        },
        week: {
            min: 1,
            max: 52,
        },
        month: {
            min: 1,
            max: 12,
        },
        year: {
            min: 1,
            max: 10,
        },
    };

    return (
        <View style={{ gap: 24, display: "flex", flexDirection: "column", width: "100%" }}>
            <View style={{ display: "flex", flexDirection: "row", gap: 16, width: "100%" }}>
                <TouchableOpacity onPress={goToStandard}>
                    <Feather name="arrow-left" size={24} color={ThemedColor.text} />
                </TouchableOpacity>
                <ThemedText type="defaultSemiBold" style={{ textAlign: "center" }}>
                    Make Recurring
                </ThemedText>
            </View>
            <ScrollView contentContainerStyle={{ gap: 24 }} style={{ height: "80%" }}>
                <ThemedText type="defaultSemiBold" style={{ fontSize: 20 }}>
                    Mode
                </ThemedText>
                <View style={{ width: "100%" }}>
                    <View style={{ flexDirection: "row", gap: 16, justifyContent: "space-evenly", width: "100%" }}>
                        <PrimaryButton
                            outline={mode !== "start"}
                            title="Recurring Start"
                            onPress={() => setMode("start")}
                            style={{ width: "45%" }}
                        />
                        <PrimaryButton
                            outline={mode !== "deadline"}
                            title="Recurring Deadline"
                            onPress={() => setMode("deadline")}
                            style={{ width: "45%" }}
                        />
                    </View>
                </View>
                <View>
                    <ThemedText type="defaultSemiBold" style={{ fontSize: 20 }}>
                        Quick Options
                    </ThemedText>
                </View>
                <View>
                    <Dropdown
                        selected={selectedQuickOption}
                        setSelected={setSelectedQuickOption}
                        onSpecial={() => {}}
                        width="100%"
                        options={quickOptions}
                    />
                </View>
                <ThemedText type="defaultSemiBold" style={{ fontSize: 20 }}>
                    Repeat Every
                </ThemedText>
                <View>
                    <View style={{ display: "flex", flexDirection: "row", gap: 8, width: "100%" }}>
                        <Picker
                            style={{ width: "50%" }}
                            selectedValue={frequencyAmount}
                            onValueChange={(itemValue) => setFrequencyAmount(itemValue)}>
                            {Array.from({ length: frequencyLimits[frequency].max }, (_, i) => (
                                <Picker.Item key={i} label={`${i + 1}`} value={i + 1} />
                            ))}
                        </Picker>
                        <Picker
                            style={{ width: "50%" }}
                            selectedValue={frequency}
                            onValueChange={(itemValue) => setFrequency(itemValue as "day" | "week" | "month" | "year")}>
                            <Picker.Item label="Days" value="day" />
                            <Picker.Item label="Weeks" value="week" />
                            {/* <Picker.Item label="Months" value="month" />
                            <Picker.Item label="Years" value="year" /> */}
                        </Picker>
                    </View>
                    {frequency === "week" && <RecurringWeekPicker rows={1} />}
                </View>
            </ScrollView>
            <PrimaryButton title="Create" onPress={() => {}} style={{ width: "100%" }} />
        </View>
    );
};

const RecurringWeekPicker = ({ rows }: { rows: number }) => {
    const ThemedColor = useThemeColor();
    const [selectedDays, setSelectedDays] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
    return (
        <View style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <ThemedText type="defaultSemiBold">Repeat On</ThemedText>
            <View style={{ display: "flex", flexDirection: "column", gap: 8, justifyContent: "space-between" }}>
                {Array.from({ length: rows }, (_, index) => (
                    <View
                        key={index}
                        style={{
                            display: "flex",
                            flexDirection: "row",
                            justifyContent: "space-evenly",
                            gap: 2,
                        }}>
                        {["S", "M", "T", "W", "T", "F", "S"].map((day, dayIndex) => (
                            <TouchableOpacity
                                key={dayIndex}
                                onPress={() => {
                                    let newSelectedDays = [...selectedDays];
                                    newSelectedDays[dayIndex] = newSelectedDays[dayIndex] === 0 ? 1 : 0;
                                    setSelectedDays(newSelectedDays);
                                }}
                                style={{
                                    width: Dimensions.get("window").width * 0.1,
                                    height: Dimensions.get("window").width * 0.1,
                                    backgroundColor:
                                        selectedDays[dayIndex] === 1 ? ThemedColor.primary : ThemedColor.primary + "05",
                                    borderRadius: 16,
                                    outlineWidth: 1,
                                    outlineColor: ThemedColor.primary,
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}>
                                <ThemedText type="defaultSemiBold">{day}</ThemedText>
                            </TouchableOpacity>
                        ))}
                    </View>
                ))}
            </View>
        </View>
    );
};

export default Recurring;
