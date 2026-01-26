import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/ThemedText';

type Props = {
    title: string;
    children: React.ReactNode;
    marginBottom?: number;
};

export const SettingsSection = ({ title, children, marginBottom = 40 }: Props) => {
    return (
        <View style={[styles.section, { marginBottom }]}>
            <ThemedText type="caption" style={styles.sectionHeader}>
                {title}
            </ThemedText>
            {children}
        </View>
    );
};

const styles = StyleSheet.create({
    section: {
        // marginBottom set dynamically
    },
    sectionHeader: {
        marginBottom: 16,
        fontSize: 12,
        letterSpacing: 1,
    },
});
