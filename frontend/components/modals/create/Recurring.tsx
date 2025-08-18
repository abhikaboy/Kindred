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
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import ConditionalView from "@/components/ui/ConditionalView";

type RecurOption = {
    label: string;
    id: string;
    special?: boolean; // For Dropdown compatibility
    config?: {
        frequency: string;
        every: number;
        daysOfWeek?: number[];
        daysOfMonth?: number[];
    };
};

type Props = {
    goToStandard: () => void;
};

const Recurring = ({ goToStandard }: Props) => {
    const ThemedColor = useThemeColor();
    const [mode, setMode] = useState<"start" | "deadline">("start");
    const [frequency, setFrequency] = useState<"day" | "week" | "month" | "year">("day");
    const [frequencyAmount, setFrequencyAmount] = useState<number>(1);
    const [customRepeat, setCustomRepeat] = useState<boolean>(false);
    const [selectedDays, setSelectedDays] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
    const { 
        startDate, 
        startTime, 
        deadline, 
        setRecurring, 
        setRecurFrequency, 
        setRecurDetails 
    } = useTaskCreation();

    const baseQuickOptions: RecurOption[] = [
        { label: "None", id: "none" },
        { label: "Daily", id: "daily", config: { frequency: "daily", every: 1 } },
    ];

    const footerOptions: RecurOption[] = [
        { label: "Custom", id: "custom" },
    ];

    const [quickOptions, setQuickOptions] = useState<RecurOption[]>(baseQuickOptions);
    const [selectedQuickOption, setSelectedQuickOption] = useState<RecurOption>(baseQuickOptions[0]);

    // Check if start and deadline are properly configured
    const isStartConfigured = startDate && startTime;
    const isDeadlineConfigured = deadline !== null;

    // Get the reference date for generating dynamic options
    const getReferenceDate = (): Date | null => {
        if (mode === "start" && isStartConfigured) {
            return startTime!;
        } else if (mode === "deadline" && isDeadlineConfigured) {
            return deadline!;
        }
        return null;
    };

    // Generate dynamic quick options based on reference date
    const generateDynamicOptions = (referenceDate: Date): RecurOption[] => {
        const options: RecurOption[] = [...baseQuickOptions];
        
        const dayOfWeek = referenceDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
        const dayOfMonth = referenceDate.getDate();
        const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        
        // Create daysOfWeek array with the specific day selected
        const daysOfWeek = [0, 0, 0, 0, 0, 0, 0];
        daysOfWeek[dayOfWeek] = 1;
        
        // Add "Every [DayName]" option
        options.push({
            label: `Every ${dayNames[dayOfWeek]}`,
            id: `every_${dayNames[dayOfWeek].toLowerCase()}`,
            config: {
                frequency: "weekly",
                every: 1,
                daysOfWeek: daysOfWeek
            }
        });
        
        // Add "Every month on the [day]" option
        options.push({
            label: `Every Month on the ${dayOfMonth}${getDaySuffix(dayOfMonth)}`,
            id: `every_month_${dayOfMonth}`,
            config: {
                frequency: "monthly",
                every: 1,
                daysOfMonth: [dayOfMonth]
            }
        });
        
        // Add weekday option if it's a weekday
        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
            options.push({
                label: "Every Weekday",
                id: "weekday",
                config: {
                    frequency: "weekly",
                    every: 1,
                    daysOfWeek: [0, 1, 1, 1, 1, 1, 0] // Monday to Friday
                }
            });
        }
        
        return options;
    };

    // Helper function to get day suffix (1st, 2nd, 3rd, etc.)
    const getDaySuffix = (day: number): string => {
        if (day >= 11 && day <= 13) return "th";
        switch (day % 10) {
            case 1: return "st";
            case 2: return "nd";
            case 3: return "rd";
            default: return "th";
        }
    };

    // Auto-switch mode if current mode becomes unavailable
    useEffect(() => {
        if (mode === "start" && !isStartConfigured && isDeadlineConfigured) {
            setMode("deadline");
        } else if (mode === "deadline" && !isDeadlineConfigured && isStartConfigured) {
            setMode("start");
        }
    }, [isStartConfigured, isDeadlineConfigured, mode]);

    // Update quick options based on mode and reference date
    useEffect(() => {
        const referenceDate = getReferenceDate();
        if (referenceDate) {
            const dynamicOptions = generateDynamicOptions(referenceDate);
            setQuickOptions(dynamicOptions);
            // Reset selected option to first one when options change
            setSelectedQuickOption(dynamicOptions[0]);
        } else {
            setQuickOptions(baseQuickOptions);
            setSelectedQuickOption(baseQuickOptions[0]);
        }
    }, [mode, startDate, startTime, deadline]);

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

    const constructRecurringObject = () => {
        // Set recurring to true
        setRecurring(true);

        let recurFreq = "";
        let recurDetailsObj: {
            every: number;
            daysOfWeek: number[];
            daysOfMonth?: number[];
            behavior: "BUILDUP" | "ROLLING";
        } = {
            every: 1,
            daysOfWeek: [0, 0, 0, 0, 0, 0, 0],
            behavior: "ROLLING",
        };

        // Validate that at least one day is selected for weekly frequency
        if (selectedQuickOption.id === "custom" && frequency === "week") {
            const hasSelectedDays = selectedDays.some(day => day === 1);
            if (!hasSelectedDays) {
                // Default to Monday if no days are selected
                recurDetailsObj.daysOfWeek = [0, 1, 0, 0, 0, 0, 0];
            }
        }

        // Handle quick options using the config
        if (selectedQuickOption.id === "none") {
            // Don't set recurring, just go back
            goToStandard();
            return;
        } else if (selectedQuickOption.config) {
            // Use the predefined configuration
            recurFreq = selectedQuickOption.config.frequency;
            recurDetailsObj.every = selectedQuickOption.config.every;
            if (selectedQuickOption.config.daysOfWeek) {
                recurDetailsObj.daysOfWeek = selectedQuickOption.config.daysOfWeek;
            }
            if (selectedQuickOption.config.daysOfMonth) {
                recurDetailsObj.daysOfMonth = selectedQuickOption.config.daysOfMonth;
            }
        } else if (selectedQuickOption.id === "custom") {
            // Handle custom frequency
            if (frequency === "day") {
                recurFreq = "daily";
            } else if (frequency === "week") {
                recurFreq = "weekly";
                // Use the selected days from the week picker
                recurDetailsObj.daysOfWeek = selectedDays;
            } else if (frequency === "month") {
                recurFreq = "monthly";
            } else if (frequency === "year") {
                recurFreq = "yearly";
            }
            recurDetailsObj.every = frequencyAmount;
        }

        // Set the recurring frequency
        setRecurFrequency(recurFreq);
        
        // Set the recurring details
        setRecurDetails(recurDetailsObj);

        // Navigate back to standard view
        goToStandard();
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
            <ScrollView contentContainerStyle={{ gap: 20 }} style={{ height: "80%" }}>
                <View style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <ThemedText type="defaultSemiBold" style={{ fontSize: 20 }}>
                        Mode
                    </ThemedText>
                    <View style={{ display: "flex", flexDirection: "row", gap: 8, width: "100%" }}>
                        <PrimaryButton
                            title="Repeat Start"
                            onPress={() => setMode("start")}
                            style={{ width: (Dimensions.get("window").width - HORIZONTAL_PADDING * 2 - 16) * 0.5 }}
                            outline={mode !== "start"}
                            disabled={!isStartConfigured}
                        />
                        <PrimaryButton
                            title="Repeat Deadline"
                            outline={mode !== "deadline"}
                            onPress={() => setMode("deadline")}
                            style={{ width: (Dimensions.get("window").width - HORIZONTAL_PADDING * 2 - 16) * 0.5 }}
                            disabled={!isDeadlineConfigured}
                        />
                    </View>
                    {(!isStartConfigured || !isDeadlineConfigured) && (
                        <View style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            {!isStartConfigured && (
                                <ThemedText type="default" style={{ fontSize: 12, color: ThemedColor.text + "80" }}>
                                    • Repeat Start requires both start date and time to be set
                                </ThemedText>
                            )}
                            {!isDeadlineConfigured && (
                                <ThemedText type="default" style={{ fontSize: 12, color: ThemedColor.text + "80" }}>
                                    • Repeat Deadline requires a deadline to be set
                                </ThemedText>
                            )}
                        </View>
                    )}
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
                        footerOptions={footerOptions}
                    />
                </View>
                <ConditionalView condition={selectedQuickOption.id === "custom"}>         
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
                        {frequency === "week" && <RecurringWeekPicker rows={1} onDaysChange={(days) => {
                            // Update the selected days for weekly frequency
                            setSelectedDays(days);
                        }} />}
                    </View>
                </ConditionalView>
            </ScrollView>
            <PrimaryButton title="Create" onPress={constructRecurringObject} style={{ width: "100%" }} />
        </View>
    );
};

const RecurringWeekPicker = ({ rows, onDaysChange }: { rows: number; onDaysChange: (days: number[]) => void }) => {
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
                                    onDaysChange(newSelectedDays);
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
