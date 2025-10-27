import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';

interface TourStepCardProps {
    title: string;
    description: string;
    onNext: () => void;
    onSkip?: () => void;
    isLastStep?: boolean;
}

export const TourStepCard: React.FC<TourStepCardProps> = ({
    title,
    description,
    onNext,
    onSkip,
    isLastStep = false,
}) => {
    const ThemedColor = useThemeColor();

    return (
        <View style={[styles.container, { backgroundColor: ThemedColor.lightened }]}>
            <View style={styles.headerContainer}>
                <ThemedText type="subtitle" style={styles.title}>
                    {title}
                </ThemedText>
                {onSkip && !isLastStep && (
                    <TouchableOpacity
                        style={styles.skipButton}
                        onPress={onSkip}>
                        <ThemedText style={[styles.skipText, { color: ThemedColor.caption }]}>
                            Skip
                        </ThemedText>
                    </TouchableOpacity>
                )}
            </View>
            <ThemedText style={styles.description}>
                {description}
            </ThemedText>
            <TouchableOpacity
                style={[
                    styles.button,
                    styles.nextButton,
                    { backgroundColor: ThemedColor.primary }
                ]}
                onPress={onNext}>
                <ThemedText style={[styles.buttonText, { color: ThemedColor.buttonText }]}>
                    {isLastStep ? 'Got it!' : 'Next'}
                </ThemedText>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 20,
        borderRadius: 12,
        maxWidth: 300,
    },
    headerContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    title: {
        flex: 1,
    },
    skipButton: {
        paddingVertical: 4,
        paddingHorizontal: 8,
    },
    skipText: {
        fontSize: 14,
    },
    description: {
        marginBottom: 16,
    },
    button: {
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
        width: '100%',
    },
    nextButton: {
        // backgroundColor set dynamically
    },
    buttonText: {
        fontWeight: '600',
    },
});

