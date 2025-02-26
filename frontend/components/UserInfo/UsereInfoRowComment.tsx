import React from "react";
import { TouchableOpacity, View, StyleSheet, Dimensions } from "react-native";
import { ThemedText } from "../ThemedText";
import { Colors } from "@/constants/Colors";
import PreviewIcon from "../profile/PreviewIcon";

type Props = {
    name: string;
    content: string;
    icon: string;
    id?: string;
    time?: number;
};

const UserInfoRowComment = ({ name, content, icon, time }: Props) => (
    <View style={{ flexDirection: "row", alignItems: "center", width: "100%" }}>
        <View style={styles.row}>
            <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
                <View style={{ paddingTop: 8 }}>
                    <PreviewIcon size={"small"} icon={icon}></PreviewIcon>
                </View>
                <View style={{ gap: 2, flex: 1 }}>
                    <View style={{ flexDirection: "row", gap: 8, alignItems: "baseline" }}>
                        <ThemedText type="caption" style={{ color: "white" }}>
                            {name}
                        </ThemedText>
                        <ThemedText type="caption">{time}hr</ThemedText>
                    </View>
                    <ThemedText style={styles.commentText} type={"default"}>
                        {content}
                    </ThemedText>
                    <TouchableOpacity>
                        <ThemedText type="caption">Reply</ThemedText>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    </View>
);

export default UserInfoRowComment;

const styles = StyleSheet.create({
    row: {
        flexDirection: "row",
        flex: 1,
        justifyContent: "space-between",
        width: "100%",
        alignItems: "flex-start",
    },
    commentText: {
        flexWrap: "wrap",
        width: "100%",
        flexShrink: 1,
    },
});
