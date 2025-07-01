import { ScrollView, View } from "react-native";
import React, { useEffect, useState } from "react";
import { ThemedText } from "@/components/ThemedText";
import Feather from "@expo/vector-icons/Feather";
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
};

const Deadline = ({ goToStandard }: Props) => {
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

    return (
        <View style={{ gap: 24, display: "flex", flexDirection: "column" }}>
            <View style={{ display: "flex", flexDirection: "row", gap: 16 }}>
                <TouchableOpacity onPress={goToStandard}>
                    <Feather name="arrow-left" size={24} color={ThemedColor.text} />
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
                contentContainerStyle={{ display: "flex", flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <SuggestedTag
                    caption={new Date().toLocaleDateString()}
                    tag="EOD Today"
                    onPress={() => {
                        setTime(new Date(new Date().setHours(23, 59, 59, 999)));
                        goToStandard();
                    }}
                />
                <SuggestedTag
                    caption={new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleDateString()}
                    tag="EOD Tomorrow"
                    onPress={() => {
                        setTime(new Date(new Date().setHours(23, 59, 59, 999)));
                        goToStandard();
                    }}
                />
                <SuggestedTag
                    caption={new Date(Date.now() + 60 * 60 * 1000).toLocaleTimeString()}
                    tag="1 Hour"
                    onPress={() => {
                        setTime(new Date(Date.now() + 60 * 60 * 1000));
                        goToStandard();
                    }}
                />
                <SuggestedTag
                    caption={new Date(new Date().setDate(new Date().getDate() + 7)).toLocaleDateString()}
                    tag="In a Week"
                    onPress={() => {
                        setTime(new Date(new Date().setHours(23, 59, 59, 999)));
                        setDate(new Date(new Date().setDate(new Date().getDate() + 7)));
                        goToStandard();
                    }}
                />
                <SuggestedTag
                    caption={new Date(
                        new Date().setDate(new Date().getDate() + (7 - new Date().getDay()))
                    ).toLocaleDateString()}
                    tag="End of This Week"
                    onPress={() => {
                        setTime(new Date(new Date().setHours(23, 59, 59, 999)));
                        setDate(new Date(new Date().setDate(new Date().getDate() + (7 - new Date().getDay())))); // the closest Sunday
                        goToStandard();
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
                onPress={goToStandard}
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
