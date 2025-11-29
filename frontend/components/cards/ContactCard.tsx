import { Dimensions, Platform, StyleSheet, TouchableOpacity, View } from "react-native";
import React from "react";
import CachedImage from "../CachedImage";
import { ThemedText } from "../ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";

type Props = {
    name: string;
    icon: string;
    handle: string;
    following: boolean;
    id?: string;
    contactName?: string; // Optional: The name from device contacts
};

const ContactCard = ({ name, icon, handle, following, id, contactName }: Props) => {
    const ThemedColor = useThemeColor();
    const styles = useStyles(ThemedColor);
    const router = useRouter();

    const handlePress = () => {
        if (id) {
            router.push(`/account/${id}`);
        }
    };

    const displayHandle = handle.startsWith("@") ? handle : `@${handle}`;

    return (
        <TouchableOpacity style={styles.container} onPress={handlePress}>
            <CachedImage
                source={{ uri: icon }}
                style={StyleSheet.absoluteFillObject}
                contentFit="cover"
                variant="medium"
                blurRadius={2}
            />
            
            <LinearGradient
                colors={["transparent", "rgba(0,0,0,0.5)"]}
                style={StyleSheet.absoluteFillObject}
                start={{ x: 0.5, y: 0.01 }}
                end={{ x: 0.5, y: 0.8 }}
            />

            <View style={styles.contentContainer}>
                <ThemedText 
                    type="captionLight" 
                    style={styles.handleText}
                >
                    {displayHandle}
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
            width: 125,
            height: 160,
            borderRadius: 12,
            overflow: "hidden",
            backgroundColor: ThemedColor.tertiary,
            marginRight: 12,
            justifyContent: "flex-end",
            borderWidth: 1,
            borderColor: ThemedColor.tertiary,
        },
        contentContainer: {
            width: "100%",
            paddingHorizontal: 12,
            paddingBottom: 12,
            overflow: "visible",
        },
        handleText: {
            color: "#9D9D9D",
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
