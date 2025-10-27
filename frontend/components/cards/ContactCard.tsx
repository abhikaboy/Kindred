import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import React from "react";
import PreviewIcon from "../profile/PreviewIcon";
import { ThemedText } from "../ThemedText";
import FollowButton from "../inputs/FollowButton";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useRouter } from "expo-router";

type Props = {
    name: string;
    icon: string;
    handle: string;
    following: boolean;
    id?: string;
    contactName?: string; // Optional: The name from device contacts
};

const ContactCard = ({ name, icon, handle, following, id, contactName }: Props) => {
    let ThemedColor = useThemeColor();
    const styles = useStyles(ThemedColor);
    const router = useRouter();

    const connectionType = following ? "friends" : "none";

    const handlePress = () => {
        if (id) {
            router.push(`/account/${id}`);
        }
    };

    return (
        <TouchableOpacity style={styles.container} onPress={handlePress}>
            <PreviewIcon size="large" icon={icon} />
            <View style={{ flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
                <View>
                    <ThemedText style={{ textAlign: "left" }} type="lightBody">
                        {name}
                    </ThemedText>
                    <ThemedText style={{ textAlign: "left" }} type="caption">
                        {handle} 
                    </ThemedText>
                    {contactName && (
                        <ThemedText 
                            style={{ textAlign: "left", marginTop: 4, fontStyle: "italic" }} 
                            type="caption"
                        >
                            {contactName}
                        </ThemedText>
                    )}
                </View>
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
            borderRadius: 12,
            borderWidth: 1,
            borderColor: ThemedColor.tertiary,
            padding: 12,
            paddingVertical: 20,
            minWidth: Dimensions.get("screen").width * 0.3,
            gap: 16,
            maxWidth: Dimensions.get("screen").width * 0.4,
            alignItems: "center",
            boxShadow: ThemedColor.shadowSmall,
        },
    });
