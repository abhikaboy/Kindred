import { CaretRight, type IconProps } from "phosphor-react-native";
import React from 'react';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';

type Props = {
    label: string;
    onPress: () => void;
    icon?: React.ComponentType<IconProps>;
    iconColor?: string;
    showChevron?: boolean;
};

export const SettingsActionRow = ({ label, onPress, icon: Icon, iconColor, showChevron = false }: Props) => {
    const ThemedColor = useThemeColor();
    const finalIconColor = iconColor || ThemedColor.text;

    return (
        <TouchableOpacity
            style={[styles.row, { borderBottomColor: ThemedColor.tertiary }]}
            onPress={onPress}
            activeOpacity={0.7}
        >
            <View style={styles.content}>
                <ThemedText type="default">
                    {label}
                </ThemedText>
                {Icon && <Icon size={24} color={finalIconColor} />}
                {showChevron && <CaretRight  size={20} color={ThemedColor.text + '60'} />}
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    row: {
        paddingVertical: 15,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
});
