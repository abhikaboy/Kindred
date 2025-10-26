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
            <View style={{ flexDirection: "column", gap: 8, alignItems: "center" }}>
                <View>
                    <ThemedText style={{ textAlign: "center" }} type="lightBody">
                        {name}
                    </ThemedText>
                    <ThemedText style={{ textAlign: "center" }} type="caption">
                        {handle} 
                    </ThemedText>
                    {contactName && (
                        <ThemedText 
                            style={{ textAlign: "center", marginTop: 4, fontStyle: "italic" }} 
                            type="caption"
                        >
                            {contactName}
                        </ThemedText>
                    )}
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
