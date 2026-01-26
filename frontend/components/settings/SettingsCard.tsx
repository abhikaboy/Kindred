import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useThemeColor } from '@/hooks/useThemeColor';

type Props = {
    children: React.ReactNode;
};

export const SettingsCard = ({ children }: Props) => {
    const ThemedColor = useThemeColor();
    
    return (
        <View style={[styles.container, { backgroundColor: ThemedColor.lightened, borderColor: ThemedColor.tertiary }]}>
            {children}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        borderRadius: 12,
        paddingHorizontal: 20,
        paddingVertical: 15,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
});
