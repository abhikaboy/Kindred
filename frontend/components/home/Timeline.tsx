import React from "react";
import { View } from "react-native";
import { ThemedText } from "../ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import DefaultCard from "../cards/DefaultCard";
import TaskCard from "../cards/TaskCard";

const TimeTick = () => {
    const ThemedColor = useThemeColor();
    return (
        <View
            style={{
                width: 1,
                height: 50,
                backgroundColor: ThemedColor.disabled,
            }}
        />
    );
};

const TimelineTicker = ({ index, children, time }: { index: number; children: React.ReactNode; time: string }) => {
    const ThemedColor = useThemeColor();
    return (
        <View key={index} style={{ alignItems: "flex-start", gap: 12 }}>
            {children}
            <ThemedText
                type="caption"
                style={{
                    fontSize: 12,
                }}>
                {time}
            </ThemedText>
        </View>
    );
};

export default function Timeline() {
    const ThemedColor = useThemeColor();
    const TICK_WIDTH = 19;
    const data = [<TimeTick />, <TimeTick />, <TimeTick />, <TimeTick />, <TimeTick />, <TimeTick />];
    const data2 = [
        <View style={{ height: 50, width: `${TICK_WIDTH * 2}%` }}>
            <TaskCard content="Project Work" value={1} priority={0} id="1" categoryId="1" height={50} />
        </View>,
        <View style={{ height: 50, width: `${TICK_WIDTH * 0.5}%` }} />,
        <View style={{ height: 50, width: `${TICK_WIDTH * 2.5}%` }}>
            <TaskCard content="Sleep" value={1} priority={0} id="1" categoryId="1" height={50} />
        </View>,
    ];
    return (
        <>
            <View
                style={{
                    flexDirection: "row",
                    justifyContent: "flex-start",
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 50,
                    zIndex: 100,
                    opacity: 0.75,
                }}>
                {data2.map((item, index) => item)}
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                {data.map((item, index) => (
                    <TimelineTicker key={index} index={index} time={index.toString() + " AM"}>
                        {item}
                    </TimelineTicker>
                ))}
            </View>
        </>
    );
}
