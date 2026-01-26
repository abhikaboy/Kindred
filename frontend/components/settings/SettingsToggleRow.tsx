import React from 'react';
import { View, StyleSheet, Switch } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';

type Props = {
    label: string;
    value: boolean;
    onValueChange: (value: boolean) => void;
};

export const SettingsToggleRow = ({ label, value, onValueChange }: Props) => {
    const ThemedColor = useThemeColor();
    
    return (
        <View style={styles.row}>
            <ThemedText type="lightBody" style={[styles.label, { color: ThemedColor.caption }]}>
                {label}
            </ThemedText>
            <Switch
                value={value}
                onValueChange={onValueChange}
                trackColor={{ false: ThemedColor.tertiary, true: ThemedColor.primary }}
                thumbColor={'#ffffff'}
                ios_backgroundColor={ThemedColor.tertiary}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        minHeight: 36,
    },
    label: {
        flex: 1,
    },
});
