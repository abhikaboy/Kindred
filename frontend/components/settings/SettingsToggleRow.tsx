import React from 'react';
import { View, StyleSheet, Switch } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';

type Props = {
    label: string;
    value: boolean;
    onValueChange: (value: boolean) => void;
    isLast?: boolean;
};

export const SettingsToggleRow = ({ label, value, onValueChange, isLast = false }: Props) => {
    const ThemedColor = useThemeColor();

    return (
        <View style={[
            styles.row,
            !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: ThemedColor.tertiary },
        ]}>
            <ThemedText type="default" style={styles.label}>
                {label}
            </ThemedText>
            <Switch
                value={value}
                onValueChange={onValueChange}
                trackColor={{ false: ThemedColor.tertiary, true: ThemedColor.primary }}
                thumbColor={'#ffffff'}
                ios_backgroundColor={ThemedColor.tertiary}
                style={styles.switch}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        minHeight: 44,
    },
    label: {
        flex: 1,
    },
    switch: {
        transform: [{ scale: 0.85 }],
    },
});
