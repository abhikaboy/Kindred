import { StyleProp, TouchableOpacity, View, ViewStyle } from "react-native";
import React from "react";
import { useThemeColor } from "@/hooks/useThemeColor";
import { ThemedText } from "../ThemedText";

type Props = {
    children?: React.ReactNode;
    title: string;
    icon: React.ReactNode;
    onPress: () => void;
    badge?: string;
    style?: StyleProp<ViewStyle>;
};

const DashboardCard = (props: Props) => {
    const ThemedColor = useThemeColor();
    const { title, icon, onPress, badge, style } = props;
    return (
        <TouchableOpacity
            style={[
                {
                    backgroundColor: ThemedColor.lightenedCard,
                    borderRadius: 12,
                    paddingVertical: 12,
                    paddingHorizontal: 14,
                    borderWidth: 0.5,
                    boxShadow: ThemedColor.shadowSmall,
                    borderColor: ThemedColor.tertiary,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                },
                style,
            ]}
            onPress={onPress}>
            {icon}
            <ThemedText type="default" numberOfLines={1}>{title}</ThemedText>
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
        </TouchableOpacity>
    );
};

export default DashboardCard;
