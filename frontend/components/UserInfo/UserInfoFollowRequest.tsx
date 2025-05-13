import React from "react";
import { TouchableOpacity, View, StyleSheet, Dimensions } from "react-native";
import { ThemedText } from "../ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import PreviewIcon from "../profile/PreviewIcon";
import PrimaryButton from "../inputs/PrimaryButton";

type Props = {
    name: string;
    username: string;
    icon: string;
    userId: string;
};

const UserInfoFollowRequest = ({ name, username, icon, userId }: Props) => (
    <View style={{ flexDirection: "row", alignItems: "center", width: "100%" }}>
        <View style={styles.row}>
            <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                <PreviewIcon size={"smallMedium"} icon={icon}></PreviewIcon>
                <View style={{ gap: 0 }}>
                    <View style={{ flexDirection: "row", gap: 8, alignItems: "baseline" }}>
                        <ThemedText numberOfLines={1} ellipsizeMode="tail" type="default">
                            {name}
                        </ThemedText>
                    </View>
                    <ThemedText numberOfLines={1} ellipsizeMode="tail" type={"caption"}>
                        @{username}
                    </ThemedText>
                </View>
            </View>
            <View style={styles.buttons}>
                <TouchableOpacity onPress={() => console.log("Denied Request")}>
                    <ThemedText style={{ fontSize: 14 }}>Deny</ThemedText>
                </TouchableOpacity>
                <PrimaryButton
                    style={{ width: 85, paddingVertical: 10, paddingHorizontal: 10 }}
                    title={"Accept"}
                    onPress={() => console.log("Accepted Request")}></PrimaryButton>
            </View>
        </View>
    </View>
);

export default UserInfoFollowRequest;

const styles = StyleSheet.create({
    row: {
        flexDirection: "row",
        flex: 1,
        justifyContent: "space-between",
        width: "100%",
        alignItems: "center",
    },
    buttons: {
        flexDirection: "row",
        flex: 1,
        gap: 14,
        alignItems: "center",
        justifyContent: "flex-end",
    },
    buttonText: {
        fontSize: 16,
    },
});
