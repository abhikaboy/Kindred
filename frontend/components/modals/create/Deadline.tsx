import { ScrollView, View } from "react-native";
import React, { useEffect, useState } from "react";
import { ThemedText } from "@/components/ThemedText";
import { ArrowLeft } from "phosphor-react-native";
import { TouchableOpacity } from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";
import ThemedCalendar from "@/components/inputs/ThemedCalendar";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { useTaskCreation } from "@/contexts/taskCreationContext";
import SuggestedTag from "@/components/inputs/SuggestedTag";
import { TimeRangePicker } from "@/components/inputs/TimeRangePicker";

type Props = {
    goToStandard: () => void;
    onSubmit?: (deadline: Date | null) => void;
};

const Deadline = ({ goToStandard, onSubmit }: Props) => {
    const ThemedColor = useThemeColor();

    const [step, setStep] = useState<1 | 2>(1);
    const [time, setTime] = useState<Date | null>(null);
    const [date, setDate] = useState<Date | null>(null);

    const { deadline, setDeadline } = useTaskCreation();

    const combineDateAndTime = () => {
        if (date && time) {
            const combined = new Date(date);
            combined.setHours(
                time.getHours(),
                time.getMinutes(),
                time.getSeconds(),
                time.getMilliseconds()
            );
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

    const handleSuggestedDeadline = (calculatedDeadline: Date) => {
        setDeadline(calculatedDeadline);
        if (onSubmit) {
            onSubmit(calculatedDeadline);
        } else {
            goToStandard();
        }
    };

    const handleFinish = () => {
        if (onSubmit) {
            onSubmit(deadline);
        } else {
            goToStandard();
        }
    };

    return (
        <View style={{ gap: 24 }}>
            <View style={{ flexDirection: "row", gap: 16, alignItems: "center" }}>
                <TouchableOpacity
                    onPress={() => {
                        if (step === 2) {
                            setStep(1);
                        } else {
                            goToStandard();
                        }
                    }}
                >
                    <ArrowLeft
                        size={24}
                        color={ThemedColor.text}
                        weight="regular"
                    />
                </TouchableOpacity>
                <ThemedText
                    type="defaultSemiBold"
                    style={{ textAlign: "center" }}
                >
                    {step === 1 ? "Pick a Date" : "Pick a Time"}
                </ThemedText>
            </View>

            {/* Summary of what's been selected */}
            <View style={{ flexDirection: "row", gap: 16 }}>
                <ThemedText type="defaultSemiBold">Deadline:</ThemedText>
                <ThemedText type="defaultSemiBold">
                    {date ? date.toLocaleDateString() : ""}
                    {date && time
                        ? ` at ${time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                        : ""}
                </ThemedText>
            </View>

            {/* Step 1: Suggested tags + Calendar */}
            {step === 1 && (
                <>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{
                            flexDirection: "row",
                            flexWrap: "wrap",
                            gap: 4,
                        }}
                    >
                        <SuggestedTag
                            caption={new Date().toLocaleDateString()}
                            tag="Today"
                            onPress={() => {
                                const todayDeadline = new Date(
                                    new Date().setHours(23, 59, 59, 999)
                                );
                                handleSuggestedDeadline(todayDeadline);
                            }}
                        />
                        <SuggestedTag
                            caption={new Date(
                                Date.now() + 24 * 60 * 60 * 1000
                            ).toLocaleDateString()}
                            tag="Tomorrow"
                            onPress={() => {
                                const tomorrow = new Date(
                                    Date.now() + 24 * 60 * 60 * 1000
                                );
                                const tomorrowDeadline = new Date(
                                    tomorrow.setHours(23, 59, 59, 999)
                                );
                                handleSuggestedDeadline(tomorrowDeadline);
                            }}
                        />
                        <SuggestedTag
                            caption={new Date(
                                Date.now() + 60 * 60 * 1000
                            ).toLocaleTimeString()}
                            tag="1 Hour"
                            onPress={() => {
                                const oneHourDeadline = new Date(
                                    Date.now() + 60 * 60 * 1000
                                );
                                handleSuggestedDeadline(oneHourDeadline);
                            }}
                        />
                        <SuggestedTag
                            caption={new Date(
                                new Date().setDate(new Date().getDate() + 7)
                            ).toLocaleDateString()}
                            tag="In a Week"
                            onPress={() => {
                                const nextWeek = new Date();
                                nextWeek.setDate(nextWeek.getDate() + 7);
                                const weekDeadline = new Date(
                                    nextWeek.setHours(23, 59, 59, 999)
                                );
                                handleSuggestedDeadline(weekDeadline);
                            }}
                        />
                        <SuggestedTag
                            caption={new Date(
                                new Date().setDate(
                                    new Date().getDate() +
                                        (7 - new Date().getDay())
                                )
                            ).toLocaleDateString()}
                            tag="End of This Week"
                            onPress={() => {
                                const endOfWeek = new Date();
                                endOfWeek.setDate(
                                    endOfWeek.getDate() +
                                        (7 - endOfWeek.getDay())
                                );
                                const endOfWeekDeadline = new Date(
                                    endOfWeek.setHours(23, 59, 59, 999)
                                );
                                handleSuggestedDeadline(endOfWeekDeadline);
                            }}
                        />
                    </ScrollView>

                    <ThemedCalendar dateReciever={setDate} />

                    <PrimaryButton
                        onPress={() => {
                            if (date) {
                                setStep(2);
                            }
                        }}
                        disabled={!date}
                        title={
                            date
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
                        startTime={time || deadline || new Date()}
                        onStartTimeChange={setTime}
                        mode="single"
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
                                setTime(null);
                                handleFinish();
                            }}
                            title="Skip Time"
                            outline
                            style={{ flex: 1 }}
                        />
                        <PrimaryButton
                            onPress={handleFinish}
                            title={
                                deadline
                                    ? "Set Deadline"
                                    : "No deadline selected"
                            }
                            style={{ flex: 1 }}
                        />
                    </View>
                </>
            )}
        </View>
    );
};

export default Deadline;
