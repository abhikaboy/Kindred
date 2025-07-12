import { View, ScrollView, Dimensions } from "react-native";
import React from "react";
import { ThemedText } from "@/components/ThemedText";
import Feather from "@expo/vector-icons/Feather";
import { TouchableOpacity } from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import SuggestedTag from "@/components/inputs/SuggestedTag";
import { Picker } from "@react-native-picker/picker";
import { useTaskCreation } from "@/contexts/taskCreationContext";
import Dropdown from "@/components/inputs/Dropdown";
import DateTimePicker from "@react-native-community/datetimepicker";
import ThemedCalendar from "@/components/inputs/ThemedCalendar";
import { combineDateAndTime, copyTime } from "@/utils/timeUtils";
import { add, Duration, sub, addHours, addMinutes } from "date-fns";
import { HORIZONTAL_PADDING } from "@/constants/spacing";

type Props = {
    goToStandard: () => void;
};

const RelativeReminderOptions = ({
    ThemedColor,
    dropdownOptions,
    type,
    setType,
    number,
    setNumber,
    unit,
    setUnit,
    unitMax,
    startTime,
    startDate,
    deadline,
}: {
    ThemedColor: any;
    dropdownOptions: { label: string; id: string }[];
    type: { label: string; id: string } | null;
    setType: (val: { label: string; id: string }) => void;
    number: number;
    setNumber: (val: number) => void;
    unit: "minutes" | "hours" | "days";
    setUnit: (val: "minutes" | "hours" | "days") => void;
    unitMax: Record<string, number>;
    startTime: Date | null;
    startDate: Date | null;
    deadline: Date | null;
}) => {
    // Define all possible suggestions
    const allSuggestions = [
        {
            tag: "10m before start",
            caption: addMinutes(new Date(startTime || startDate), -10).toLocaleTimeString(),
            type: "start",
            before: true,
            minutes: 10,
        },
        {
            tag: "1h before start",
            caption: addHours(new Date(startTime || startDate), -1).toLocaleTimeString(),
            type: "start",
            before: true,
            minutes: 60,
        },
        {
            tag: "1h after start",
            caption: addHours(new Date(startTime || startDate), 1).toLocaleTimeString(),
            type: "start",
            before: false,
            minutes: 60,
        },
        {
            tag: "1h before deadline",
            caption: addHours(new Date(deadline), -1).toLocaleTimeString(),
            type: "deadline",
            before: true,
            minutes: 60,
        },
        {
            tag: "6h before deadline",
            caption: addHours(new Date(deadline), -6).toLocaleTimeString(),
            type: "deadline",
            before: true,
            minutes: 360,
        },
        {
            tag: "1h after deadline",
            caption: addHours(new Date(deadline), -6).toLocaleTimeString(),
            type: "deadline",
            before: false,
            minutes: 60,
        },
    ];

    // Filter suggestions based on available times
    const availableSuggestions = allSuggestions.filter((suggestion) => {
        if (suggestion.type === "start" && (startTime || startDate)) {
            return true;
        }
        if (suggestion.type === "deadline" && deadline) {
            return true;
        }
        return false;
    });

    const handleSuggestionPress = (suggestion: (typeof allSuggestions)[0]) => {
        // Set the appropriate type
        const typeLabel = `${suggestion.before ? "Before" : "After"} ${suggestion.type === "start" ? "start time" : "deadline"}`;
        setType({ label: typeLabel, id: typeLabel });

        // Set the number and unit
        if (suggestion.minutes >= 60) {
            setNumber(Math.floor(suggestion.minutes / 60));
            setUnit("hours");
        } else {
            setNumber(suggestion.minutes);
            setUnit("minutes");
        }
    };

    return (
        <>
            <View>
                <ThemedText type="defaultSemiBold" style={{ fontSize: 20 }}>
                    Suggestions
                </ThemedText>
            </View>
            <View>
                <ScrollView horizontal contentContainerStyle={{ gap: 8 }} showsHorizontalScrollIndicator={false}>
                    <View style={{ gap: 8, display: "flex", flexDirection: "row" }}>
                        {availableSuggestions.map((suggestion, index) => (
                            <SuggestedTag
                                key={index}
                                tag={suggestion.tag}
                                caption={suggestion.caption}
                                onPress={() => handleSuggestionPress(suggestion)}
                            />
                        ))}
                    </View>
                </ScrollView>
            </View>
            <View>
                <ThemedText type="defaultSemiBold" style={{ fontSize: 20 }}>
                    When
                </ThemedText>
            </View>
            <View style={{ display: "flex", flexDirection: "column", gap: 8, height: "100%", width: "100%" }}>
                <View
                    style={{
                        borderRadius: 12,
                        padding: 2,
                        width: "100%",
                    }}>
                    <Dropdown
                        options={dropdownOptions}
                        selected={type || { label: "No options", id: "" }}
                        setSelected={setType}
                        onSpecial={() => {}}
                        width="100%"
                    />
                </View>
                <View
                    style={{
                        display: "flex",
                        flexDirection: "row",
                        gap: 8,
                        alignItems: "center",
                        borderColor: ThemedColor.border,
                        backgroundColor: ThemedColor.lightened,
                        borderRadius: 12,
                        padding: 2,
                    }}>
                    <Picker selectedValue={number} style={{ flex: 1 }} onValueChange={setNumber}>
                        {Array.from({ length: unitMax[unit] }, (_, i) => (
                            <Picker.Item key={i + 1} label={`${i + 1}`} value={i + 1} />
                        ))}
                    </Picker>
                    <Picker selectedValue={unit} style={{ flex: 1 }} onValueChange={(val) => setUnit(val)}>
                        <Picker.Item label="Minutes" value="minutes" />
                        <Picker.Item label="Hours" value="hours" />
                        <Picker.Item label="Days" value="days" />
                    </Picker>
                </View>
            </View>
        </>
    );
};

const AbsoluteReminderOptions = ({
    setTime,
    setDate,
    date,
    time,
}: {
    setTime: (val: Date) => void;
    setDate: (val: Date) => void;
    date: Date | null;
    time: Date | null;
}) => {
    // Combine date and time for display
    let summary = "No date/time selected";
    if (date && time) {
        summary = `${date.toLocaleDateString()} at ${time.toLocaleTimeString()}`;
    } else if (date) {
        summary = date.toLocaleDateString();
    } else if (time) {
        summary = time.toLocaleTimeString();
    }

    return (
        <>
            <View style={{ display: "flex", flexDirection: "row", gap: 16, alignItems: "center" }}>
                <ThemedText type="defaultSemiBold">Reminder:</ThemedText>
                <ThemedText type="defaultSemiBold">{summary}</ThemedText>
            </View>
            <ThemedCalendar dateReciever={setDate} />
            <View style={{ alignItems: "flex-end", width: "100%" }}>
                <DateTimePicker
                    style={{ width: 180 }}
                    value={time || new Date()}
                    onChange={(event, selectedDate) => {
                        if (selectedDate) {
                            setTime(selectedDate);
                        }
                    }}
                    testID="reminder-time-picker"
                    mode="time"
                    is24Hour={true}
                />
            </View>
        </>
    );
};

const Reminder = ({ goToStandard }: Props) => {
    const ThemedColor = useThemeColor();
    const { startTime, startDate, deadline, setReminders } = useTaskCreation();

    const [number, setNumber] = React.useState(1);
    const [unit, setUnit] = React.useState<"minutes" | "hours" | "days">("minutes");
    const [type, setType] = React.useState<{ label: string; id: string } | null>(null);
    const [reminderType, setReminderType] = React.useState<"relative" | "absolute">("relative");
    const [time, setTime] = React.useState<Date | null>(null);
    const [date, setDate] = React.useState<Date | null>(null);
    // Max values for each unit
    const unitMax: Record<string, number> = {
        minutes: 59,
        hours: 23,
        days: 30,
    };

    // Type options based on available times
    const typeOptions = [
        ...(startTime || startDate ? ["Before start time", "After start time"] : []),
        ...(deadline ? ["Before deadline", "After deadline"] : []),
    ];
    const dropdownOptions = typeOptions.map((opt) => ({ label: opt, id: opt }));

    // Ensure selected type is valid
    React.useEffect(() => {
        if (!typeOptions.find((opt) => type?.id === opt)) {
            setType(dropdownOptions[0] || null);
        }
    }, [startTime, startDate, deadline]);

    // Ensure number is within range if unit changes
    React.useEffect(() => {
        if (number > unitMax[unit]) {
            setNumber(unitMax[unit]);
        }
    }, [unit]);

    // If there are no type options, select Absolute
    React.useEffect(() => {
        if (typeOptions.length === 0) {
            setReminderType("absolute");
        }
    }, [typeOptions.length]);

    return (
        <View style={{ gap: 24, display: "flex", flexDirection: "column", height: "100%" }}>
            <View style={{ display: "flex", flexDirection: "row", gap: 16 }}>
                <TouchableOpacity onPress={goToStandard}>
                    <Feather name="arrow-left" size={24} color={ThemedColor.text} />
                </TouchableOpacity>
                <ThemedText type="defaultSemiBold" style={{ textAlign: "center" }}>
                    Add Reminder
                </ThemedText>
            </View>
            <ScrollView
                contentContainerStyle={{
                    gap: 24,
                    display: "flex",
                    flexDirection: "column",
                }}>
                <View style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <ThemedText type="defaultSemiBold" style={{ fontSize: 20 }}>
                        Reminder Type
                    </ThemedText>
                    <View style={{ display: "flex", flexDirection: "row", gap: 8, width: "100%" }}>
                        <PrimaryButton
                            title="Relative"
                            onPress={() => setReminderType("relative")}
                            style={{ width: (Dimensions.get("window").width - HORIZONTAL_PADDING * 2 - 16) * 0.5 }}
                            outline={reminderType !== "relative"}
                        />
                        <PrimaryButton
                            title="Absolute"
                            outline={reminderType !== "absolute"}
                            onPress={() => setReminderType("absolute")}
                            style={{ width: (Dimensions.get("window").width - HORIZONTAL_PADDING * 2 - 16) * 0.5 }}
                        />
                    </View>
                </View>
                {reminderType === "relative" && (
                    <RelativeReminderOptions
                        ThemedColor={ThemedColor}
                        dropdownOptions={dropdownOptions}
                        type={type}
                        setType={setType}
                        number={number}
                        setNumber={setNumber}
                        unit={unit}
                        setUnit={setUnit}
                        unitMax={unitMax}
                        startTime={startTime}
                        startDate={startDate}
                        deadline={deadline}
                    />
                )}
                {reminderType === "absolute" && (
                    <AbsoluteReminderOptions setTime={setTime} setDate={setDate} date={date} time={time} />
                )}
            </ScrollView>
            <View style={{ display: "flex", flexDirection: "row", gap: 8 }}>
                <PrimaryButton
                    title="Add Reminder"
                    onPress={() => {
                        let reminder = ProduceReminder(
                            reminderType,
                            number,
                            unit,
                            type,
                            time || new Date(),
                            startDate,
                            startTime,
                            deadline
                        );
                        if (reminder) {
                            console.log(reminder);
                            goToStandard();
                            setReminders([reminder]);
                        }
                    }}
                    style={{ width: "100%", marginBottom: 32 }}
                />
            </View>
        </View>
    );
};

const ProduceReminder = (
    reminderType: "relative" | "absolute",
    number: number,
    unit: "minutes" | "hours" | "days",
    type: { label: string; id: string } | null,
    time: Date,
    startDate: Date,
    startTime: Date,
    deadline: Date
): Reminder => {
    let triggerTime = new Date();

    // For absolute reminders, use the provided time directly
    if (reminderType === "absolute") {
        triggerTime = new Date(time);
    } else {
        if (type?.label.toLowerCase().includes("start")) {
            triggerTime = combineDateAndTime(startDate, startTime || startDate);
        } else if (type?.label.toLowerCase().includes("deadline")) {
            triggerTime = new Date(deadline);
        }

        const duration: Duration = { [unit]: number };
        console.log(duration);
        // For relative reminders, calculate based on the reference time
        if (type?.label.toLowerCase().includes("before")) {
            triggerTime = sub(triggerTime, duration);
        } else {
            triggerTime = add(triggerTime, duration);
        }
    }

    // Determine the relative flags based on the type
    const afterStart = type?.label.toLowerCase().includes("after start time") || false;
    const beforeStart = type?.label.toLowerCase().includes("before start time") || false;
    const afterDeadline = type?.label.toLowerCase().includes("after deadline") || false;
    const beforeDeadline = type?.label.toLowerCase().includes("before deadline") || false;

    return {
        triggerTime: triggerTime,
        type: reminderType.toUpperCase(),
        sent: false,
        afterStart,
        beforeStart,
        beforeDeadline,
        afterDeadline,
    };
};

export default Reminder;
