import React from "react";
import { TouchableOpacity, View, StyleSheet, Dimensions } from "react-native";
import { ThemedText } from "../ThemedText";
import { Colors } from "@/constants/Colors";
import PreviewIcon from "../profile/PreviewIcon";

type Props = {
    name: string;
    username: string;
    time: number;
    icon: string;
    id?: string;
};

const TaskCard = ({ name, username, time, icon }: Props) => {
    return (
        <View style={{ flexDirection: "row" }}>
            <View style={styles.row}>
                <PreviewIcon size="small" icon={icon}></PreviewIcon>
                <View style={styles.col}>
                    <ThemedText numberOfLines={1} ellipsizeMode="tail" style={{ textAlign: "left" }} type="default">
                        {name}
                    </ThemedText>
                    <ThemedText numberOfLines={1} ellipsizeMode="tail" type="caption">
                        @{username}
                    </ThemedText>
                </View>
                <ThemedText style={{ textAlign: "right", textAlignVertical: "top", marginTop: -15 }} type="caption">
                    {time}hr ago
                </ThemedText>
            </View>
        </View>
    );
};

export default TaskCard;

const styles = StyleSheet.create({
    row: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    col: {
        flexDirection: "column",
        width: Dimensions.get("window").width * 0.6,
    },
    caption: {
        alignItems: "baseline",
    },
});
