import { View } from "react-native";
import React, { useState } from "react";
import { ThemedText } from "@/components/ThemedText";
import Feather from "@expo/vector-icons/Feather";
import { TouchableOpacity } from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";
import DateTimePicker from "@react-native-community/datetimepicker";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { useTaskCreation } from "@/contexts/taskCreationContext";
import { formatLocalTime } from "@/utils/timeUtils";
import SuggestedTag from "@/components/inputs/SuggestedTag";

type Props = {
    goToStandard: () => void;
};

const StartTime = ({ goToStandard }: Props) => {
    const ThemedColor = useThemeColor();
    const { startDate, startTime, setStartTime, addSmartStartReminders } = useTaskCreation();
    return (
        <View style={{ gap: 24, display: "flex", flexDirection: "column" }}>
            <View style={{ display: "flex", flexDirection: "row", gap: 16 }}>
                <TouchableOpacity onPress={goToStandard}>
                    <Feather name="arrow-left" size={24} color={ThemedColor.text} />
                </TouchableOpacity>
                <ThemedText type="defaultSemiBold" style={{ textAlign: "center" }}>
                    Set Start Time
                </ThemedText>
            </View>
            <View style={{ display: "flex", flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                <SuggestedTag
                    tag="Now"
                    onPress={() => {
                        const t = new Date();
                        setStartTime(t);
                        if (startDate) addSmartStartReminders(startDate, t);
                        goToStandard();
                    }}
                />
                <SuggestedTag
                    tag="In 15 Minutes"
                    onPress={() => {
                        const t = new Date(Date.now() + 15 * 60 * 1000);
                        setStartTime(t);
                        if (startDate) addSmartStartReminders(startDate, t);
                        goToStandard();
                    }}
                />
                <SuggestedTag
                    tag="In 1 Hour"
                    onPress={() => {
                        const t = new Date(Date.now() + 30 * 60 * 1000);
                        setStartTime(t);
                        if (startDate) addSmartStartReminders(startDate, t);
                        goToStandard();
                    }}
                />
                <SuggestedTag
                    tag="Noon"
                    onPress={() => {
                        const t = new Date(new Date().setHours(12, 0, 0, 0));
                        setStartTime(t);
                        if (startDate) addSmartStartReminders(startDate, t);
                        goToStandard();
                    }}
                />
            </View>
            <DateTimePicker
                style={{ width: "100%", height: 100 }}
                value={startTime || new Date()}
                onChange={(event, selectedDate) => {
                    if (selectedDate) {
                        setStartTime(selectedDate);
                    }
                }}
                testID="bruh"
                mode="time"
                is24Hour={true}
                display="spinner"
            />
            <PrimaryButton
                onPress={() => {
                    if (startDate && startTime) addSmartStartReminders(startDate, startTime);
                    goToStandard();
                }}
                title={startTime ? "Set Start Time: " + formatLocalTime(startTime) : "Set Start Time"}
            />
        </View>
    );
};

export default StartTime;
