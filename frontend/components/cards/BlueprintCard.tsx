import React, { useState } from "react";
import { TouchableOpacity, View, StyleSheet, Image, Dimensions } from "react-native";
import { ThemedText } from "../ThemedText";
import { useRouter } from "expo-router";
import { useThemeColor } from "@/hooks/useThemeColor";
import PrimaryButton from "../inputs/PrimaryButton";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import Feather from "@expo/vector-icons/Feather";

interface TaskProps {
    content: string;
    value: number;
    priority: string;
    redirect?: boolean;
    encourage?: boolean;
    id: string;
    categoryId: string;
}

interface Props {
    previewImage: string;
    workspaceName: string;
    username: string;
    name: string;
    time: string;
    subscriberCount: number;
    description: string;
    tasks: TaskProps[];
    tags: string[];
}

const BlueprintCard = ({ previewImage, workspaceName, username, name, time, subscriberCount, tags }: Props) => {
    let ThemedColor = useThemeColor();
    const styles = stylesheet(ThemedColor);
    return (
        <View style={styles.container}>
            <TouchableOpacity>
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

                        <ThemedText type="caption">{subscriberCount} Subscribers</ThemedText>
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
