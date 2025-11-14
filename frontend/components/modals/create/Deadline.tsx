import { ScrollView, View } from "react-native";
import React, { useEffect, useState } from "react";
import { ThemedText } from "@/components/ThemedText";
import { ArrowLeft } from "phosphor-react-native";
import { TouchableOpacity } from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";
import ThemedCalendar from "@/components/inputs/ThemedCalendar";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useTaskCreation } from "@/contexts/taskCreationContext";
import { formatLocalDate, formatLocalTime } from "@/utils/timeUtils";
import SuggestedTag from "@/components/inputs/SuggestedTag";

type Props = {
    goToStandard: () => void;
    onSubmit?: (deadline: Date | null) => void;
};

const Deadline = ({ goToStandard, onSubmit }: Props) => {
    const ThemedColor = useThemeColor();

    const [time, setTime] = useState<Date | null>(null);
    const [date, setDate] = useState<Date | null>(null);

    const { deadline, setDeadline } = useTaskCreation();

    const combineDateAndTime = () => {
        if (date && time) {
            // Combine local date and time parts
            const combined = new Date(date);
            combined.setHours(time.getHours(), time.getMinutes(), time.getSeconds(), time.getMilliseconds());
            setDeadline(combined);
            return;
        }
        if (date) {
            setDeadline(new Date(date));
            return;
        }
        if (time) {
            setDeadline(new Date(time));
            return;
        }
        setDeadline(null);
    };

    useEffect(() => {
        combineDateAndTime();
    }, [date, time]);

    // Reusable function to handle suggested tag selection
    const handleSuggestedDeadline = (calculatedDeadline: Date) => {
        setDeadline(calculatedDeadline);
        if (onSubmit) {
            onSubmit(calculatedDeadline);
        } else {
            goToStandard();
        }
    };

    return (
        <View style={{ gap: 24, display: "flex", flexDirection: "column" }}>
            <View style={{ display: "flex", flexDirection: "row", gap: 16 }}>
                <TouchableOpacity onPress={goToStandard}>
                    <ArrowLeft size={24} color={ThemedColor.text} weight="regular" />
                </TouchableOpacity>
                <ThemedText type="defaultSemiBold" style={{ textAlign: "center" }}>
                    Set Deadline
                </ThemedText>
            </View>
            <View style={{ display: "flex", flexDirection: "row", gap: 16 }}>
                <ThemedText type="defaultSemiBold">Deadline:</ThemedText>
                <ThemedText type="defaultSemiBold">{deadline ? deadline.toLocaleDateString() : ""}</ThemedText>
            </View>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ display: "flex", flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
                <SuggestedTag
                    caption={new Date().toLocaleDateString()}
                    tag="Today"
                    onPress={() => {
                        const todayDeadline = new Date(new Date().setHours(23, 59, 59, 999));
                        handleSuggestedDeadline(todayDeadline);
                    }}
                />
                <SuggestedTag
                    caption={new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleDateString()}
                    tag="Tomorrow"
                    onPress={() => {
                        const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
                        const tomorrowDeadline = new Date(tomorrow.setHours(23, 59, 59, 999));
                        handleSuggestedDeadline(tomorrowDeadline);
                    }}
                />
                <SuggestedTag
                    caption={new Date(Date.now() + 60 * 60 * 1000).toLocaleTimeString()}
                    tag="1 Hour"
                    onPress={() => {
                        const oneHourDeadline = new Date(Date.now() + 60 * 60 * 1000);
                        handleSuggestedDeadline(oneHourDeadline);
                    }}
                />
                <SuggestedTag
                    caption={new Date(new Date().setDate(new Date().getDate() + 7)).toLocaleDateString()}
                    tag="In a Week"
                    onPress={() => {
                        const nextWeek = new Date();
                        nextWeek.setDate(nextWeek.getDate() + 7);
                        const weekDeadline = new Date(nextWeek.setHours(23, 59, 59, 999));
                        handleSuggestedDeadline(weekDeadline);
                    }}
                />
                <SuggestedTag
                    caption={new Date(
                        new Date().setDate(new Date().getDate() + (7 - new Date().getDay()))
                    ).toLocaleDateString()}
                    tag="End of This Week"
                    onPress={() => {
                        const endOfWeek = new Date();
                        endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()));
                        const endOfWeekDeadline = new Date(endOfWeek.setHours(23, 59, 59, 999));
                        handleSuggestedDeadline(endOfWeekDeadline);
                    }}
                />
            </ScrollView>
            <ThemedCalendar dateReciever={setDate} />
            <DateTimePicker
                style={{ width: 500, alignSelf: "center" }}
                value={time || new Date()}
                onChange={(event, selectedDate) => {
                    if (selectedDate) {
                        setTime(selectedDate);
                    }
                }}
                testID="bruh"
                mode="time"
                is24Hour={true}
            />

            <PrimaryButton
                onPress={() => {
                    if (onSubmit) {
                        onSubmit(deadline);
                    } else {
                        goToStandard();
                    }
                }}
                title={
                    deadline
                        ? "Set Deadline: " + deadline.toLocaleDateString() + " at " + deadline.toLocaleTimeString()
                        : "No deadline selected"
                }
            />
        </View>
    );
};

export default Deadline;
