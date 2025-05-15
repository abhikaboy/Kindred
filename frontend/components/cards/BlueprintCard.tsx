import React, { useState } from "react";
import { TouchableOpacity, View, StyleSheet, Image, Dimensions } from "react-native";
import { ThemedText } from "../ThemedText";
import { useRouter } from "expo-router";
import { useThemeColor } from "@/hooks/useThemeColor";
import PrimaryButton from "../inputs/PrimaryButton";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import Feather from "@expo/vector-icons/Feather";
import { useBlueprints } from "@/contexts/blueprintContext";

interface Props {
    id: string;
    previewImage: string;
    userImage: string; 
    workspaceName: string;
    username: string;
    name: string;
    time: string;
    subscriberCount: number;
    description: string;
    tags: string[];
}

const BlueprintCard = ({
    id,
    previewImage,
    userImage,
    workspaceName,
    username,
    name,
    time,
    subscriberCount,
    description,
    tags,
}: Props) => {
    let ThemedColor = useThemeColor();
    const styles = stylesheet(ThemedColor);
    const router = useRouter();
    const { setSelectedBlueprint } = useBlueprints();


    const handlePress = () => {
        setSelectedBlueprint({
            id,
            previewImage,
            userImage,
            workspaceName,
            username,
            name,
            time,
            subscriberCount,
            description,
            tags,
        });
        router.push({
            pathname: "/(logged-in)/(tabs)/search/blueprint/[id]",
            params: {
                id: id,
                name: workspaceName,
            },
        });
    };

    return (
        <View style={styles.container}>
            <TouchableOpacity onPress={handlePress}>
                <Image
                    source={{ uri: previewImage }}
                    style={{
                        height: 135,
                        borderTopLeftRadius: 11,
                        borderTopRightRadius: 11,
                    }}
                />
                <View style={styles.informationContainer}>
                    <ThemedText type="subtitle">{workspaceName}</ThemedText>
                    <View style={{ flexDirection: "row", gap: 5, alignItems: "center" }}>
                        <MaterialIcons name="access-alarm" size={20} color={ThemedColor.text} />{" "}
                        <ThemedText type="smallerDefault">{time}</ThemedText>
                    </View>

                    <View style={{ flexDirection: "row", gap: 5, alignItems: "center" }}>
                        <Feather name="users" size={18} color={ThemedColor.caption} />

                        <ThemedText type="caption">{subscriberCount} subscribers</ThemedText>
                    </View>
                    <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
                        {tags.map((tag, index) => (
                            <ThemedText
                                key={index}
                                style={[styles.tag, { borderColor: ThemedColor.primaryPressed }]}
                                type="smallerDefault">
                                {tag}
                            </ThemedText>
                        ))}
                    </View>

                    <PrimaryButton
                        style={{ width: 85, paddingVertical: 10, paddingHorizontal: 10 }}
                        title={"Subscribe"}
                        onPress={() => console.log("subscribed to", { workspaceName })}></PrimaryButton>
                </View>
            </TouchableOpacity>
        </View>
    );
};

const stylesheet = (ThemedColor: any) =>
    StyleSheet.create({
        container: {
            width: 280,
            flexDirection: "column",
        },
        informationContainer: {
            flexDirection: "column",
            paddingHorizontal: 15,
            paddingVertical: 18,
            gap: 7,
            backgroundColor: ThemedColor.lightened,
            borderBottomLeftRadius: 11,
            borderBottomRightRadius: 11,
        },
        tag: {
            borderWidth: 1,
            borderRadius: 8,
            paddingHorizontal: 10,
            paddingVertical: 5,
            marginBottom: 4,
        },
    });

export default BlueprintCard;
