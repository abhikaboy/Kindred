import React from "react";
import { TouchableOpacity, View, StyleSheet, Dimensions } from "react-native";
import { ThemedText } from "../ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import PreviewIcon from "../profile/PreviewIcon";
import { router } from "expo-router";

type Props = {
    name: string;
    username: string;
    right: React.ReactNode;
    icon: string;
    id?: string;
    large?: boolean;
};

const UserInfoRowBase = ({ name, username, right, icon, large, id }: Props) => (
    <View style={{ flexDirection: "row", alignItems: "center", width: "100%" }}>
        <View style={styles.row}>
            <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                <TouchableOpacity onPress={() => (id != null && id != "" ? router.push(`/account/${id}`) : null)}>
                    <PreviewIcon size={large ? "medium" : "small"} icon={icon}></PreviewIcon>
                </TouchableOpacity>
                <View style={{ gap: 0 }}>
                    <View style={{ flexDirection: "row", gap: 8, alignItems: "baseline" }}>
                        <ThemedText numberOfLines={1} ellipsizeMode="tail" type="default">
                            {name}
                        </ThemedText>
                    </View>
                    <ThemedText numberOfLines={1} ellipsizeMode="tail" type={"caption"}>
                        {username}
                    </ThemedText>
                </View>
            </View>
            {right}
        </View>
    </View>
);

export default UserInfoRowBase;

const styles = StyleSheet.create({
    row: {
        flexDirection: "row",
        flex: 1,
        justifyContent: "space-between",
        width: "100%",
        alignItems: "center",
    },
});
