import { Dimensions, View } from "react-native";
import React, { useState } from "react";
import { ThemedText } from "@/components/ThemedText";
import Feather from "@expo/vector-icons/Feather";
import { TouchableOpacity } from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { Picker } from "@react-native-picker/picker";
import Dropdown from "@/components/inputs/Dropdown";

type Props = {
    goToStandard: () => void;
};

const Recurring = ({ goToStandard }: Props) => {
    const ThemedColor = useThemeColor();
    const [mode, setMode] = useState<"start" | "deadline">("start");
    const [frequency, setFrequency] = useState<"day" | "week" | "month" | "year">("day");
    const [frequencyAmount, setFrequencyAmount] = useState<number>(1);

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
        <View style={{ gap: 24, display: "flex", flexDirection: "column" }}>
            <View style={{ display: "flex", flexDirection: "row", gap: 16 }}>
                <TouchableOpacity onPress={goToStandard}>
                    <Feather name="arrow-left" size={24} color={ThemedColor.text} />
                </TouchableOpacity>
                <ThemedText type="defaultSemiBold" style={{ textAlign: "center" }}>
                    Make Recurring
                </ThemedText>
            </View>
            <ThemedText type="defaultSemiBold" style={{ fontSize: 20 }}>
                Mode
            </ThemedText>
            <View>
                <View style={{ display: "flex", flexDirection: "row", gap: 8, width: "100%" }}>
                    <PrimaryButton
                        outline
                        title="Recurring Start"
                        onPress={() => {}}
                        style={{ width: "50%", height: 48 }}
                    />
                    <PrimaryButton title="Recurring Deadline" onPress={() => {}} style={{ width: "50%", height: 48 }} />
                </View>
            </View>
            <View>
                <ThemedText type="defaultSemiBold" style={{ fontSize: 20 }}>
                    Quick Options
                </ThemedText>
            </View>
            <View>
                <Dropdown
                    selected={{ label: "Daily", id: "daily" }}
                    setSelected={() => {}}
                    onSpecial={() => {}}
                    options={[
                        { label: "Daily", id: "daily" },
                        { label: "Every Week On", id: "weekly" },
                        { label: "Every Month On", id: "monthly" },
                        { label: "Annually", id: "yearly" },
                        { label: "Every Weekday", id: "weekday" },
                    ]}
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
                        <Picker.Item label="Months" value="month" />
                        <Picker.Item label="Years" value="year" />
                    </Picker>
                </View>
                <RecurringWeekPicker rows={3} />
            </View>
        </View>
    );
};

const RecurringWeekPicker = ({ rows }: { rows: number }) => {
    const ThemedColor = useThemeColor();
    return (
        <View style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <ThemedText type="defaultSemiBold">Repeat On</ThemedText>
            <View style={{ display: "flex", flexDirection: "column", gap: 8, justifyContent: "space-between" }}>
                {Array.from({ length: rows }, (_, index) => (
                    <View
                        key={index}
                        style={{ display: "flex", flexDirection: "row", gap: 8, justifyContent: "space-between" }}>
                        {["S", "M", "T", "W", "T", "F", "S"].map((day, dayIndex) => (
                            <TouchableOpacity
                                key={dayIndex}
                                style={{
                                    width: Dimensions.get("window").width * 0.1,
                                    height: Dimensions.get("window").width * 0.1,
                                    backgroundColor: ThemedColor.primary + "05",
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
