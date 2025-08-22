import React from "react";
import { TouchableOpacity, View, StyleSheet, Dimensions, Platform } from "react-native";
import { ThemedText } from "../ThemedText";
import PreviewIcon from "../profile/PreviewIcon";
import { useThemeColor } from "@/hooks/useThemeColor";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";

type Props = {
    name: string;
    content: string;
    icon: string;
    id?: string;
    time?: number;
    onReply?: (commentId: string, userName: string) => void;
};

const UserInfoRowComment = ({ name, content, icon, time, id, onReply }: Props) => {
    const ThemedColor = useThemeColor();

    const handleReply = () => {
        if (onReply && id) {
            onReply(id, name);
        }
    };

    return (
        <View style={{ flexDirection: "row", alignItems: "center", width: "100%" }}>
           
                <View style={styles.row}>
                    <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
                        <View style={{ paddingTop: 8 }}>
                            <PreviewIcon size={"smallMedium"} icon={icon} />
                        </View>
                        <View style={{ gap: 2, flex: 1 }}>
                            <View style={{ flexDirection: "row", gap: 8, alignItems: "baseline" }}>
                                <ThemedText
                                    type="caption"
                                    style={{
                                        color: ThemedColor.text,
                                    }}>
                                    {name || "Unknown User"}
                                </ThemedText>
                                {time !== undefined && (
                                    <ThemedText
                                        type="caption"
                                        style={{
                                            color: ThemedColor.caption,
                                        }}>
                                        {time < 1 ? `${Math.round(time * 60)}m ago` : `${Math.round(time)}h ago`}
                                    </ThemedText>
                                )}
                            </View>
                            <ThemedText
                                style={[
                                    styles.commentText,
                                    {
                                        color: ThemedColor.text,
                                    },
                                ]}
                                type={"default"}>
                                {content}
                            </ThemedText>
                            <TouchableOpacity onPress={handleReply}>
                                <ThemedText
                                    type="caption"
                                    style={{
                                        color: ThemedColor.caption,
                                    }}>
                                    Reply
                                </ThemedText>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
        </View>
    );
};

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
        lineHeight: 20,
    },
});
