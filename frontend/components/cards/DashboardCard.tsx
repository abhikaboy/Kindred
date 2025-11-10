import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import React from "react";
import { useThemeColor } from "@/hooks/useThemeColor";
import { ThemedText } from "../ThemedText";
import Svg, { Path } from "react-native-svg";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import { router } from "expo-router";

type Props = {
    children?: React.ReactNode;
    title: string;
    icon: React.ReactNode;
    onPress: () => void;
    badge?: string;
};

const DashboardCard = (props: Props) => {
    const ThemedColor = useThemeColor();
    const { title, icon, onPress, badge } = props;
    return (
        <TouchableOpacity
            style={{
                backgroundColor: ThemedColor.lightenedCard,
                borderRadius: 12,
                padding: 16,
                marginBottom: 5, 
                aspectRatio: 1.6,
                justifyContent: "flex-end",
                width: (Dimensions.get("window").width - HORIZONTAL_PADDING * 2) / 2.1,
                borderWidth: 0.5,
                boxShadow: ThemedColor.shadowSmall,
                borderColor: ThemedColor.tertiary, 
            }}
            onPress={onPress}>
            <View style={{ flexDirection: "column", alignItems: "flex-start", gap: 8, width: "100%" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                {icon}
                    {badge && (
                        <View style={{
                            backgroundColor: ThemedColor.primary + '20',
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                            borderRadius: 4,
                        }}>
                            <ThemedText style={{ 
                                fontSize: 10, 
                                fontWeight: '600',
                                color: ThemedColor.primary,
                            }}>
                                {badge}
                            </ThemedText>
                        </View>
                    )}
                </View>

                <View style={{ flexDirection: "row", justifyContent: "space-between", width: "100%" }}>
                    <ThemedText type="default">{title}</ThemedText>
                    <ThemedText type="defaultSemiBold" style={{ color: ThemedColor.primary }}   >{"→"}</ThemedText>
                </View>
            </View>
        </TouchableOpacity>
    );
};

export default DashboardCard;

const styles = StyleSheet.create({});
