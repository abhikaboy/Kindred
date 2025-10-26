import { View } from "react-native";
import React, { useState, useEffect } from "react";
import { ThemedText } from "@/components/ThemedText";
import Feather from "@expo/vector-icons/Feather";
import { TouchableOpacity } from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";
import ThemedCalendar from "@/components/inputs/ThemedCalendar";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { useTaskCreation } from "@/contexts/taskCreationContext";
import { formatLocalDate, formatLocalTime } from "@/utils/timeUtils";
import SuggestedTag from "@/components/inputs/SuggestedTag";
import DateTimePicker from "@react-native-community/datetimepicker";

type Props = {
    goToStandard: () => void;
    onSubmit?: (startDate: Date | null, startTime?: Date | null) => void;
};

const StartDate = ({ goToStandard, onSubmit }: Props) => {
    const ThemedColor = useThemeColor();
    const { startDate, setStartDate, startTime, setStartTime } = useTaskCreation();
    
    // Set default time to 11:59 PM when component mounts if no time is set
    useEffect(() => {
        if (!startTime) {
            const defaultTime = new Date();
            defaultTime.setHours(23, 59, 0, 0);
            setStartTime(defaultTime);
        }
    }, []);
    
    return (
        <View style={{ gap: 24, display: "flex", flexDirection: "column" }}>
            <View style={{ display: "flex", flexDirection: "row", gap: 16 }}>
                <TouchableOpacity onPress={goToStandard}>
                    <Feather name="arrow-left" size={24} color={ThemedColor.text} />
                </TouchableOpacity>
                <ThemedText type="defaultSemiBold" style={{ textAlign: "center" }}>
                    Set Start Date & Time
                </ThemedText>
            </View>
            <View style={{ display: "flex", flexDirection: "row", gap: 16 }}>
                <ThemedText type="defaultSemiBold">Start Date:</ThemedText>
                <ThemedText type="defaultSemiBold">{startDate ? startDate.toLocaleDateString() : ""}</ThemedText>
            </View>
            <View style={{ display: "flex", flexDirection: "row", gap: 4 }}>
                <SuggestedTag
                    caption={new Date().toLocaleDateString()}
                    tag="Today"
                    onPress={() => {
                        const newDate = new Date();
                        setStartDate(newDate);
                        goToStandard();
                    }}
                />
                <SuggestedTag
                    caption={new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleDateString()}
                    tag="Tomorrow"
                    onPress={() => {
                        const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
                        setStartDate(tomorrow);
                        goToStandard();
                    }}
                />
                <SuggestedTag
                    caption={new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString()}
                    tag="In a Week"
                    onPress={() => {
                        const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
                        setStartDate(nextWeek);
                        goToStandard();
                    }}
                />
            </View>
            <View style={{ 
                display: "flex", 
                flexDirection: "row", 
                alignItems: "center", 
                justifyContent: "space-between",
                paddingVertical: 8,
            }}>
                <ThemedText type="defaultSemiBold">Time:</ThemedText>
                <DateTimePicker
                    value={startTime || new Date(new Date().setHours(23, 59, 0, 0))}
                    onChange={(event, selectedTime) => {
                        if (selectedTime) {
                            setStartTime(selectedTime);
                        }
                    }}
                    mode="time"
                    is24Hour={false}
                    display="default"
                    themeVariant={ThemedColor.theme === "dark" ? "dark" : "light"}
                />
            </View>
            <ThemedCalendar dateReciever={setStartDate} />
            <PrimaryButton 
                onPress={() => {
                    if (onSubmit) {
                        onSubmit(startDate, startTime);
                    } else {
                        goToStandard();
                    }
                }} 
                title={`Set Start: ${startDate ? startDate.toLocaleDateString() : 'Select Date'} ${startTime ? formatLocalTime(startTime) : ''}`}
            />
        </View>
    );
};

export default StartDate;
