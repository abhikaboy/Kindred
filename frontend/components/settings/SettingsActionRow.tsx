import React from 'react';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';
import Ionicons from '@expo/vector-icons/Ionicons';

type Props = {
    label: string;
    onPress: () => void;
    icon?: keyof typeof Ionicons.glyphMap;
    iconColor?: string;
    showChevron?: boolean;
};

export const SettingsActionRow = ({ label, onPress, icon, iconColor, showChevron = false }: Props) => {
    const ThemedColor = useThemeColor();
    const finalIconColor = iconColor || ThemedColor.text;
    
    return (
        <TouchableOpacity 
            style={[styles.row, { borderBottomColor: ThemedColor.tertiary }]}
            onPress={onPress}
            activeOpacity={0.7}
        >
            <View style={styles.content}>
                <ThemedText type="lightBody" style={{ color: ThemedColor.text }}>
                    {label}
                </ThemedText>
                {icon && <Ionicons name={icon} size={24} color={finalIconColor} />}
                {showChevron && <Ionicons name="chevron-forward" size={20} color={ThemedColor.text + '60'} />}
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
