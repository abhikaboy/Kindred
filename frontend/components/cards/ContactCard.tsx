import { Dimensions, Platform, StyleSheet, TouchableOpacity, View } from "react-native";
import React from "react";
import CachedImage from "../CachedImage";
import { ThemedText } from "../ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { formatHandle } from "@/utils/handle";

type Props = {
    name: string;
    icon: string;
    handle: string;
    following: boolean;
    id?: string;
    contactName?: string; // Optional: The name from device contacts
    width?: number; // Optional: override the fixed carousel width (e.g. to fill a grid column)
};

const ContactCard = ({ name, icon, handle, following, id, contactName, width }: Props) => {
    const ThemedColor = useThemeColor();
    const styles = useStyles(ThemedColor);
    const router = useRouter();

    const handlePress = () => {
        if (id) {
            router.push(`/account/${id}`);
        }
    };

    const displayHandle = formatHandle(handle);

    return (
        <TouchableOpacity
            style={[
                styles.container,
                // Keep the card a bit taller than wide (matches the carousel ratio).
                width != null && { width, height: width * 1.28, marginRight: 0 },
            ]}
            onPress={handlePress}>

            <CachedImage source={{ uri: icon }} style={StyleSheet.absoluteFillObject} contentFit="cover" variant="medium" />

            <LinearGradient
                colors={["transparent", "rgba(0,0,0,0.65)"]}
                style={StyleSheet.absoluteFillObject}
                start={{ x: 0.5, y: 0.35 }}
                end={{ x: 0.5, y: 1 }}
            />

            <View style={styles.contentContainer}>
                <ThemedText type="captionLight" style={styles.handleText} numberOfLines={1}>
                    {contactName ? `${contactName} in your contacts` : displayHandle}
                </ThemedText>

                <View style={styles.nameRow}>
                    <ThemedText
                        type="defaultSemiBold"
                        style={styles.nameText}
                        lightColor="#FFFFFF"
                        darkColor="#FFFFFF"
                        numberOfLines={1}
                    >
                        {name}
                    </ThemedText>
                    <ThemedText
                        type="defaultSemiBold"
                        style={styles.arrowText}
                        lightColor="#FFFFFF"
                        darkColor="#FFFFFF"
                    >
                        →
                    </ThemedText>
                </View>
            </View>
        </TouchableOpacity>
    );
};

export default ContactCard;

const useStyles = (ThemedColor: any) =>
    StyleSheet.create({
        container: {
            width: 140,
            height: 180,
            borderRadius: 20,
            overflow: "hidden",
            backgroundColor: ThemedColor.tertiary,
            marginRight: 12,
            justifyContent: "flex-end",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.12,
            shadowRadius: 12,
            elevation: 3,
        },
        contentContainer: {
            width: "100%",
            paddingHorizontal: 12,
            paddingBottom: 12,
            overflow: "visible",
        },
        handleText: {
            color: "rgba(255,255,255,0.75)",
            marginBottom: 0,
        },
        nameRow: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
        },
        nameText: {
            flex: 1,
            marginRight: 4,
            color: "#FFFFFF",
        },
        arrowText: {
            textAlign: "center",
            color: "#FFFFFF",
        },
    });
