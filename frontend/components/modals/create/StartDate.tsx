import { View } from "react-native";
import React, { useEffect, useState } from "react";
import { ThemedText } from "@/components/ThemedText";
import Feather from "@expo/vector-icons/Feather";
import { TouchableOpacity } from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";
import ThemedCalendar from "@/components/inputs/ThemedCalendar";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { useTaskCreation } from "@/contexts/taskCreationContext";
import { formatLocalTime } from "@/utils/timeUtils";
import SuggestedTag from "@/components/inputs/SuggestedTag";
import { TimeRangePicker } from "@/components/inputs/TimeRangePicker";

type Props = {
    goToStandard: () => void;
    onSubmit?: (startDate: Date | null, startTime?: Date | null) => void;
};

const StartDate = ({ goToStandard, onSubmit }: Props) => {
    const ThemedColor = useThemeColor();
    const [step, setStep] = useState<1 | 2>(1);
    const {
        startDate,
        setStartDate,
        startTime,
        setStartTime,
        deadline,
        setDeadline,
    } = useTaskCreation();

    useEffect(() => {
        if (!startTime) {
            const defaultTime = new Date();
            defaultTime.setHours(23, 59, 0, 0);
            setStartTime(defaultTime);
        }
    }, []);

    const hasDeadline = deadline != null;

    const handleFinish = () => {
        if (onSubmit) {
            onSubmit(startDate, startTime);
        } else {
            goToStandard();
        }
    };

    return (
        <View style={{ gap: 24 }}>
            <View
                style={{
                    flexDirection: "row",
                    gap: 16,
                    alignItems: "center",
                }}
            >
                <TouchableOpacity
                    onPress={() => {
                        if (step === 2) {
                            setStep(1);
                        } else {
                            goToStandard();
                        }
                    }}
                >
                    <Feather
                        name="arrow-left"
                        size={24}
                        color={ThemedColor.text}
                    />
                </TouchableOpacity>
                <ThemedText
                    type="defaultSemiBold"
                    style={{ textAlign: "center" }}
                >
                    {step === 1 ? "Pick a Date" : "Pick a Time"}
                </ThemedText>
            </View>

            {/* Summary */}
            <View style={{ flexDirection: "row", gap: 16 }}>
                <ThemedText type="defaultSemiBold">Start:</ThemedText>
                <ThemedText type="defaultSemiBold">
                    {startDate ? startDate.toLocaleDateString() : ""}
                    {startDate && startTime
                        ? ` at ${formatLocalTime(startTime)}`
                        : ""}
                </ThemedText>
            </View>

            {/* Step 1: Suggested tags + Calendar */}
            {step === 1 && (
                <>
                    <View style={{ flexDirection: "row", gap: 4 }}>
                        <SuggestedTag
                            caption={new Date().toLocaleDateString()}
                            tag="Today"
                            onPress={() => {
                                setStartDate(new Date());
                                setStep(2);
                            }}
                        />
                        <SuggestedTag
                            caption={new Date(
                                Date.now() + 24 * 60 * 60 * 1000
                            ).toLocaleDateString()}
                            tag="Tomorrow"
                            onPress={() => {
                                setStartDate(
                                    new Date(
                                        Date.now() + 24 * 60 * 60 * 1000
                                    )
                                );
                                setStep(2);
                            }}
                        />
                        <SuggestedTag
                            caption={new Date(
                                Date.now() + 7 * 24 * 60 * 60 * 1000
                            ).toLocaleDateString()}
                            tag="In a Week"
                            onPress={() => {
                                setStartDate(
                                    new Date(
                                        Date.now() +
                                            7 * 24 * 60 * 60 * 1000
                                    )
                                );
                                setStep(2);
                            }}
                        />
                    </View>

                    <ThemedCalendar dateReciever={setStartDate} />

                    <PrimaryButton
                        onPress={() => {
                            if (startDate) {
                                setStep(2);
                            }
                        }}
                        disabled={!startDate}
                        title={
                            startDate
                                ? "Next: Set Time"
                                : "Select a date to continue"
                        }
                    />
                </>
            )}

            {/* Step 2: Time picker */}
            {step === 2 && (
                <>
                    <TimeRangePicker
                        startTime={startTime}
                        endTime={hasDeadline ? deadline : undefined}
                        onStartTimeChange={setStartTime}
                        onEndTimeChange={
                            hasDeadline ? setDeadline : undefined
                        }
                        mode={hasDeadline ? "range" : "single"}
                    />

                    <View
                        style={{
                            flexDirection: "row",
                            gap: 8,
                            marginBottom: 40,
                        }}
                    >
                        <PrimaryButton
                            onPress={() => {
                                setStartTime(null);
                                handleFinish();
                            }}
                            title="Skip Time"
                            outline
                            style={{ flex: 1 }}
                        />
                        <PrimaryButton
                            onPress={handleFinish}
                            title={`Set Start${startDate ? ": " + startDate.toLocaleDateString() : ""}`}
                            style={{ flex: 1 }}
                        />
                    </View>
                </>
            )}
        </View>
    );
};

export default StartDate;
