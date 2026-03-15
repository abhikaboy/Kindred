import React, { useCallback, useEffect, useState } from "react";
import { View, StyleSheet, TouchableOpacity, Platform } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    runOnJS,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import DateTimePicker from "@react-native-community/datetimepicker";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";

interface TimeRangePickerProps {
    startTime: Date | null;
    endTime?: Date | null;
    onStartTimeChange: (date: Date) => void;
    onEndTimeChange?: (date: Date) => void;
    mode?: "range" | "single";
}

const HOUR_HEIGHT = 48;
const HANDLE_HEIGHT = 30;
const TRACK_HORIZONTAL_PADDING = 48;
const TRACK_VERTICAL_PADDING = HANDLE_HEIGHT / 2 + 2;

const formatMinutesToTime = (totalMinutes: number): string => {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    const ampm = h >= 12 ? "PM" : "AM";
    const dh = h % 12 || 12;
    return `${dh}:${m.toString().padStart(2, "0")} ${ampm}`;
};

const formatMinutesShort = (totalMinutes: number): string => {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    const dh = h % 12 || 12;
    return `${dh}:${m.toString().padStart(2, "0")}`;
};

const dateToMinutes = (d: Date): number => d.getHours() * 60 + d.getMinutes();

const minutesToDate = (totalMinutes: number): Date => {
    const d = new Date();
    d.setHours(Math.floor(totalMinutes / 60), totalMinutes % 60, 0, 0);
    return d;
};

export const TimeRangePicker: React.FC<TimeRangePickerProps> = ({
    startTime,
    endTime,
    onStartTimeChange,
    onEndTimeChange,
    mode = "range",
}) => {
    const ThemedColor = useThemeColor();
    const isRange = mode === "range" && onEndTimeChange != null;

    const initStartMins = startTime
        ? Math.round(dateToMinutes(startTime) / 15) * 15
        : 480;
    const initPeriod = initStartMins >= 720 ? "PM" : "AM";

    const [period, setPeriod] = useState<"AM" | "PM">(initPeriod);
    const [showNativePicker, setShowNativePicker] = useState(false);
    const [nativePickerTarget, setNativePickerTarget] = useState<
        "start" | "end"
    >("start");

    const minMin = period === "AM" ? 0 : 720;
    const maxMin = period === "AM" ? 720 : 1440;
    const totalH = 12 * HOUR_HEIGHT;

    const minMinSV = useSharedValue(minMin);
    const maxMinSV = useSharedValue(maxMin);
    const totalHSV = useSharedValue(totalH);

    useEffect(() => {
        minMinSV.value = minMin;
        maxMinSV.value = maxMin;
        totalHSV.value = totalH;
    }, [period]);

    const startMinutes = useSharedValue(
        startTime
            ? Math.round(dateToMinutes(startTime) / 15) * 15
            : Math.round((minMin + 480) / 15) * 15
    );
    const endMinutes = useSharedValue(
        endTime
            ? Math.round(dateToMinutes(endTime) / 15) * 15
            : Math.round((minMin + 540) / 15) * 15
    );

    const lastSnappedStart = useSharedValue(startMinutes.value);
    const lastSnappedEnd = useSharedValue(endMinutes.value);

    const [startLabel, setStartLabel] = useState(
        formatMinutesToTime(startMinutes.value)
    );
    const [startLabelShort, setStartLabelShort] = useState(
        formatMinutesShort(startMinutes.value)
    );
    const [endLabel, setEndLabel] = useState(
        formatMinutesToTime(endMinutes.value)
    );
    const [endLabelShort, setEndLabelShort] = useState(
        formatMinutesShort(endMinutes.value)
    );

    const triggerHaptic = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, []);

    const updateStartLabel = useCallback((mins: number) => {
        setStartLabel(formatMinutesToTime(mins));
        setStartLabelShort(formatMinutesShort(mins));
    }, []);

    const updateEndLabel = useCallback((mins: number) => {
        setEndLabel(formatMinutesToTime(mins));
        setEndLabelShort(formatMinutesShort(mins));
    }, []);

    const commitStartChange = useCallback(
        (mins: number) => {
            setStartLabel(formatMinutesToTime(mins));
            setStartLabelShort(formatMinutesShort(mins));
            onStartTimeChange(minutesToDate(mins));
        },
        [onStartTimeChange]
    );

    const commitEndChange = useCallback(
        (mins: number) => {
            setEndLabel(formatMinutesToTime(mins));
            setEndLabelShort(formatMinutesShort(mins));
            onEndTimeChange?.(minutesToDate(mins));
        },
        [onEndTimeChange]
    );

    // --- Tap to move handle ---
    const handleTrackTap = useCallback(
        (y: number) => {
            const yInTrack = y - TRACK_VERTICAL_PADDING;
            const rawMins =
                (yInTrack / totalH) * (maxMin - minMin) + minMin;
            const snapped =
                Math.round(
                    Math.max(minMin, Math.min(maxMin, rawMins)) / 15
                ) * 15;

            if (!isRange) {
                startMinutes.value = snapped;
                lastSnappedStart.value = snapped;
                commitStartChange(snapped);
            } else {
                const distToStart = Math.abs(
                    snapped - startMinutes.value
                );
                const distToEnd = Math.abs(snapped - endMinutes.value);
                if (distToStart <= distToEnd) {
                    const clamped = Math.min(
                        snapped,
                        endMinutes.value - 15
                    );
                    startMinutes.value = clamped;
                    lastSnappedStart.value = clamped;
                    commitStartChange(clamped);
                } else {
                    const clamped = Math.max(
                        snapped,
                        startMinutes.value + 15
                    );
                    endMinutes.value = clamped;
                    lastSnappedEnd.value = clamped;
                    commitEndChange(clamped);
                }
            }
            triggerHaptic();
        },
        [
            isRange,
            minMin,
            maxMin,
            totalH,
            commitStartChange,
            commitEndChange,
            triggerHaptic,
        ]
    );

    const trackTapGesture = Gesture.Tap().onEnd((event) => {
        "worklet";
        runOnJS(handleTrackTap)(event.y);
    });

    // --- Pan gestures for handles ---
    // Labels update live during drag; parent callback only fires on end.
    const startPanGesture = Gesture.Pan()
        .onUpdate((event) => {
            "worklet";
            const mn = minMinSV.value;
            const mx = maxMinSV.value;
            const th = totalHSV.value;
            const basePx =
                ((lastSnappedStart.value - mn) / (mx - mn)) * th;
            const rawMins =
                ((basePx + event.translationY) / th) * (mx - mn) + mn;
            const snapped =
                Math.round(
                    Math.max(mn, Math.min(mx - 15, rawMins)) / 15
                ) * 15;
            const limit = isRange ? endMinutes.value - 15 : mx;
            const clamped = Math.min(snapped, limit);

            if (clamped !== startMinutes.value) {
                startMinutes.value = clamped;
                runOnJS(triggerHaptic)();
                runOnJS(updateStartLabel)(clamped);
            }
        })
        .onEnd(() => {
            "worklet";
            lastSnappedStart.value = startMinutes.value;
            runOnJS(commitStartChange)(startMinutes.value);
        });

    const endPanGesture = Gesture.Pan()
        .onUpdate((event) => {
            "worklet";
            const mn = minMinSV.value;
            const mx = maxMinSV.value;
            const th = totalHSV.value;
            const basePx =
                ((lastSnappedEnd.value - mn) / (mx - mn)) * th;
            const rawMins =
                ((basePx + event.translationY) / th) * (mx - mn) + mn;
            const snapped =
                Math.round(
                    Math.max(mn + 15, Math.min(mx, rawMins)) / 15
                ) * 15;
            const clamped = Math.max(snapped, startMinutes.value + 15);

            if (clamped !== endMinutes.value) {
                endMinutes.value = clamped;
                runOnJS(triggerHaptic)();
                runOnJS(updateEndLabel)(clamped);
            }
        })
        .onEnd(() => {
            "worklet";
            lastSnappedEnd.value = endMinutes.value;
            runOnJS(commitEndChange)(endMinutes.value);
        });

    // --- Animated styles ---
    const startHandleStyle = useAnimatedStyle(() => {
        const mn = minMinSV.value;
        const mx = maxMinSV.value;
        const th = totalHSV.value;
        const px = ((startMinutes.value - mn) / (mx - mn)) * th;
        return {
            transform: [
                {
                    translateY:
                        TRACK_VERTICAL_PADDING +
                        px -
                        HANDLE_HEIGHT / 2,
                },
            ],
        };
    });

    const endHandleStyle = useAnimatedStyle(() => {
        const mn = minMinSV.value;
        const mx = maxMinSV.value;
        const th = totalHSV.value;
        const px = ((endMinutes.value - mn) / (mx - mn)) * th;
        return {
            transform: [
                {
                    translateY:
                        TRACK_VERTICAL_PADDING +
                        px -
                        HANDLE_HEIGHT / 2,
                },
            ],
        };
    });

    const selectedRangeStyle = useAnimatedStyle(() => {
        if (!isRange) {
            return { opacity: 0, height: 0, top: 0 };
        }
        const mn = minMinSV.value;
        const mx = maxMinSV.value;
        const th = totalHSV.value;
        const topPx = ((startMinutes.value - mn) / (mx - mn)) * th;
        const bottomPx = ((endMinutes.value - mn) / (mx - mn)) * th;
        return {
            top: TRACK_VERTICAL_PADDING + topPx,
            height: bottomPx - topPx,
            opacity: 1,
        };
    });

    const displayMinHour = period === "AM" ? 0 : 12;
    const hours = Array.from({ length: 13 }, (_, i) => i + displayMinHour);

    const handlePeriodSwitch = (newPeriod: "AM" | "PM") => {
        if (newPeriod === period) return;
        setPeriod(newPeriod);

        const offset = newPeriod === "PM" ? 720 : -720;
        const newStart = Math.max(
            0,
            Math.min(1425, startMinutes.value + offset)
        );
        startMinutes.value = newStart;
        lastSnappedStart.value = newStart;
        commitStartChange(newStart);

        if (isRange) {
            const newEnd = Math.max(
                0,
                Math.min(1440, endMinutes.value + offset)
            );
            endMinutes.value = newEnd;
            lastSnappedEnd.value = newEnd;
            commitEndChange(newEnd);
        }
    };

    const handleNativePickerChange = (
        _event: any,
        selectedDate: Date | undefined
    ) => {
        if (Platform.OS === "android") setShowNativePicker(false);
        if (!selectedDate) return;

        const mins = Math.round(dateToMinutes(selectedDate) / 15) * 15;
        const newPeriod = mins >= 720 ? "PM" : "AM";
        if (newPeriod !== period) setPeriod(newPeriod);

        if (nativePickerTarget === "start") {
            startMinutes.value = mins;
            lastSnappedStart.value = mins;
            commitStartChange(mins);
        } else {
            endMinutes.value = mins;
            lastSnappedEnd.value = mins;
            commitEndChange(mins);
        }
    };

    const openNativePicker = (target: "start" | "end") => {
        setNativePickerTarget(target);
        setShowNativePicker(true);
    };

    return (
        <View style={pickerStyles.wrapper}>
            {/* Header row: time badge(s) + AM/PM toggle */}
            <View style={pickerStyles.headerRow}>
                <View style={pickerStyles.timeBadgesRow}>
                    <TouchableOpacity
                        onPress={() => openNativePicker("start")}
                    >
                        <View
                            style={[
                                pickerStyles.timeBadge,
                                {
                                    backgroundColor: `${ThemedColor.primary}15`,
                                },
                            ]}
                        >
                            <ThemedText
                                type="defaultSemiBold"
                                style={{
                                    color: ThemedColor.primary,
                                    fontSize: 15,
                                }}
                            >
                                {startLabel}
                            </ThemedText>
                        </View>
                    </TouchableOpacity>
                    {isRange && (
                        <>
                            <ThemedText
                                type="caption"
                                style={{ fontSize: 13 }}
                            >
                                to
                            </ThemedText>
                            <TouchableOpacity
                                onPress={() => openNativePicker("end")}
                            >
                                <View
                                    style={[
                                        pickerStyles.timeBadge,
                                        {
                                            backgroundColor: `${ThemedColor.primary}15`,
                                        },
                                    ]}
                                >
                                    <ThemedText
                                        type="defaultSemiBold"
                                        style={{
                                            color: ThemedColor.primary,
                                            fontSize: 15,
                                        }}
                                    >
                                        {endLabel}
                                    </ThemedText>
                                </View>
                            </TouchableOpacity>
                        </>
                    )}
                </View>

                <View
                    style={[
                        pickerStyles.periodToggle,
                        { backgroundColor: `${ThemedColor.tertiary}40` },
                    ]}
                >
                    <TouchableOpacity
                        onPress={() => handlePeriodSwitch("AM")}
                        style={[
                            pickerStyles.periodButton,
                            period === "AM" && {
                                backgroundColor: ThemedColor.primary,
                            },
                        ]}
                    >
                        <ThemedText
                            type="defaultSemiBold"
                            style={{
                                fontSize: 13,
                                color:
                                    period === "AM"
                                        ? "#FFFFFF"
                                        : ThemedColor.text,
                            }}
                        >
                            AM
                        </ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => handlePeriodSwitch("PM")}
                        style={[
                            pickerStyles.periodButton,
                            period === "PM" && {
                                backgroundColor: ThemedColor.primary,
                            },
                        ]}
                    >
                        <ThemedText
                            type="defaultSemiBold"
                            style={{
                                fontSize: 13,
                                color:
                                    period === "PM"
                                        ? "#FFFFFF"
                                        : ThemedColor.text,
                            }}
                        >
                            PM
                        </ThemedText>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Native picker for precise control */}
            {showNativePicker && (
                <View style={pickerStyles.nativePickerRow}>
                    <DateTimePicker
                        value={
                            nativePickerTarget === "start"
                                ? minutesToDate(startMinutes.value)
                                : minutesToDate(endMinutes.value)
                        }
                        mode="time"
                        minuteInterval={5}
                        onChange={handleNativePickerChange}
                        display={
                            Platform.OS === "ios" ? "spinner" : "default"
                        }
                        style={{ height: 120 }}
                    />
                </View>
            )}

            {/* Track with vertical padding so handles don't overflow */}
            <View
                style={[
                    pickerStyles.track,
                    {
                        height: totalH + TRACK_VERTICAL_PADDING * 2,
                        borderColor: ThemedColor.tertiary,
                    },
                ]}
            >
                {/* Hour grid lines — offset by -HOUR_HEIGHT/2 so the
                    centered line aligns with the pixel position */}
                {hours.map((hour) => {
                    const top =
                        TRACK_VERTICAL_PADDING +
                        (hour - displayMinHour) * HOUR_HEIGHT -
                        HOUR_HEIGHT / 2;
                    return (
                        <View
                            key={hour}
                            style={[pickerStyles.hourRow, { top }]}
                            pointerEvents="none"
                        >
                            <ThemedText
                                type="caption"
                                style={pickerStyles.hourLabel}
                            >
                                {hour === 0
                                    ? "12 AM"
                                    : hour === 12
                                      ? "12 PM"
                                      : hour > 12
                                        ? `${hour - 12} PM`
                                        : `${hour} AM`}
                            </ThemedText>
                            <View
                                style={[
                                    pickerStyles.hourLine,
                                    {
                                        backgroundColor:
                                            ThemedColor.caption,
                                    },
                                ]}
                            />
                        </View>
                    );
                })}

                {isRange && (
                    <Animated.View
                        pointerEvents="none"
                        style={[
                            selectedRangeStyle,
                            {
                                position: "absolute",
                                left: TRACK_HORIZONTAL_PADDING,
                                right: 0,
                                backgroundColor: `${ThemedColor.primary}20`,
                                borderLeftWidth: 3,
                                borderLeftColor: ThemedColor.primary,
                            },
                        ]}
                    />
                )}

                {/* Tap target covering full track area */}
                <GestureDetector gesture={trackTapGesture}>
                    <Animated.View
                        style={[
                            StyleSheet.absoluteFill,
                            { zIndex: 10 },
                        ]}
                    />
                </GestureDetector>

                {/* Draggable handles */}
                <GestureDetector gesture={startPanGesture}>
                    <Animated.View
                        style={[
                            pickerStyles.handle,
                            startHandleStyle,
                            { left: TRACK_HORIZONTAL_PADDING - 6 },
                        ]}
                    >
                        <View
                            style={[
                                pickerStyles.handleDot,
                                { backgroundColor: ThemedColor.primary },
                            ]}
                        />
                        <View
                            style={[
                                pickerStyles.handleLine,
                                { backgroundColor: ThemedColor.primary },
                            ]}
                        />
                        <View
                            style={[
                                pickerStyles.handleBadge,
                                {
                                    backgroundColor: ThemedColor.primary,
                                },
                            ]}
                        >
                            <ThemedText
                                type="defaultSemiBold"
                                style={pickerStyles.handleText}
                            >
                                {startLabelShort}
                            </ThemedText>
                        </View>
                    </Animated.View>
                </GestureDetector>

                {isRange && (
                    <GestureDetector gesture={endPanGesture}>
                        <Animated.View
                            style={[
                                pickerStyles.handle,
                                endHandleStyle,
                                { left: TRACK_HORIZONTAL_PADDING - 6 },
                            ]}
                        >
                            <View
                                style={[
                                    pickerStyles.handleDot,
                                    {
                                        backgroundColor:
                                            ThemedColor.primary,
                                    },
                                ]}
                            />
                            <View
                                style={[
                                    pickerStyles.handleLine,
                                    {
                                        backgroundColor:
                                            ThemedColor.primary,
                                    },
                                ]}
                            />
                            <View
                                style={[
                                    pickerStyles.handleBadge,
                                    {
                                        backgroundColor:
                                            ThemedColor.primary,
                                    },
                                ]}
                            >
                                <ThemedText
                                    type="defaultSemiBold"
                                    style={pickerStyles.handleText}
                                >
                                    {endLabelShort}
                                </ThemedText>
                            </View>
                        </Animated.View>
                    </GestureDetector>
                )}
            </View>

            {/* Precise control link */}
            {!showNativePicker && (
                <TouchableOpacity
                    onPress={() => openNativePicker("start")}
                    style={pickerStyles.preciseLink}
                >
                    <ThemedText
                        type="caption"
                        style={{
                            color: ThemedColor.primary,
                            fontSize: 13,
                        }}
                    >
                        Use precise time picker
                    </ThemedText>
                </TouchableOpacity>
            )}
        </View>
    );
};

const pickerStyles = StyleSheet.create({
    wrapper: {
        gap: 12,
    },
    headerRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    timeBadgesRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        flexShrink: 1,
    },
    periodToggle: {
        flexDirection: "row",
        borderRadius: 10,
        padding: 3,
    },
    periodButton: {
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 8,
    },
    timeBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 10,
    },
    nativePickerRow: {
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 4,
    },
    track: {
        position: "relative",
        borderRadius: 12,
        borderWidth: 1,
        overflow: "hidden",
    },
    hourRow: {
        position: "absolute",
        left: 0,
        right: 0,
        flexDirection: "row",
        alignItems: "center",
        height: HOUR_HEIGHT,
    },
    hourLabel: {
        width: TRACK_HORIZONTAL_PADDING - 4,
        fontSize: 10,
        textAlign: "right",
        paddingRight: 4,
    },
    hourLine: {
        flex: 1,
        height: 1,
        opacity: 0.15,
    },
    handle: {
        position: "absolute",
        right: 0,
        height: HANDLE_HEIGHT,
        flexDirection: "row",
        alignItems: "center",
        zIndex: 20,
    },
    handleDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: "#FFFFFF",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.15,
        shadowRadius: 2,
        elevation: 2,
    },
    handleLine: {
        flex: 1,
        height: 2,
    },
    handleBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        marginRight: 8,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.15,
        shadowRadius: 2,
        elevation: 2,
    },
    handleText: {
        color: "#FFFFFF",
        fontSize: 11,
        letterSpacing: 0.2,
    },
    preciseLink: {
        alignSelf: "center",
        paddingVertical: 4,
    },
});
