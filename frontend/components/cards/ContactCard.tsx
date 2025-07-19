import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import React from "react";
import PreviewIcon from "../profile/PreviewIcon";
import { ThemedText } from "../ThemedText";
import FollowButton from "../inputs/FollowButton";
import { useThemeColor } from "@/hooks/useThemeColor";

type Props = {
    name: string;
    icon: string;
    handle: string;
    following: boolean;
    id?: string;
};

const ContactCard = ({ name, icon, handle, following, id }: Props) => {
    let ThemedColor = useThemeColor();
    const styles = useStyles(ThemedColor);

    const connectionType = following ? "friends" : "none";

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
                {id && <FollowButton connectionType={connectionType} followeeid={id} />}
            </View>
        </TouchableOpacity>
    );
};

export default ContactCard;

const useStyles = (ThemedColor: any) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: ThemedColor.lightened,
            borderRadius: 10,
            padding: 24,
            gap: 12,
            maxWidth: Dimensions.get("screen").width * 0.4,
            alignItems: "center",
            boxShadow: ThemedColor.shadowSmall,
        },
    });
