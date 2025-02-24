import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import React from "react";
import PreviewIcon from "../profile/PreviewIcon";
import { ThemedText } from "../ThemedText";
import FollowButton from "../inputs/FollowButton";
import { Colors } from "@/constants/Colors";

type Props = {
    name: string;
    icon: string;
    handle: string;
    following: boolean;
    id?: string;
};

const ContactCard = ({ name, icon, handle, following }: Props) => {
    return (
        <TouchableOpacity style={styles.container}>
            <PreviewIcon size="large" icon={icon} />
            <View style={{ flexDirection: "column", gap: 8, alignItems: "center" }}>
                <View>
                    <ThemedText style={{ textAlign: "center" }} type="lightBody">
                        {name}
                    </ThemedText>
                    <ThemedText style={{ textAlign: "center" }} type="caption">
                        @{handle}
                    </ThemedText>
                </View>
                <FollowButton following={following} />
            </View>
        </TouchableOpacity>
    );
};

export default ContactCard;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.dark.lightened,
        borderRadius: 10,
        padding: 16,
        margin: 8,
        gap: 12,
        maxWidth: Dimensions.get("screen").width * 0.4,
        alignItems: "center",
    },
});
