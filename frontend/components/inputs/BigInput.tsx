import React from 'react';
import { View, TextInput, StyleSheet, TextInputProps } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';

type BigInputProps = {
    label: string;
    value: string;
    onChangeText: (text: string) => void;
    placeholder: string;
    error?: string;
    helperText?: string;
    showError: boolean;
    prefix?: string;
    suffix?: React.ReactNode;
} & Omit<TextInputProps, 'style' | 'placeholder' | 'value' | 'onChangeText'>;

export const BigInput = React.memo(({
    label,
    value,
    onChangeText,
    placeholder,
    error,
    helperText,
    showError,
    prefix,
    suffix,
    ...inputProps
}: BigInputProps) => {
    const ThemedColor = useThemeColor();
    const themedStyles = styles(ThemedColor);

    return (
        <View style={themedStyles.fieldContainer}>
            <View style={themedStyles.labelRow}>
                <ThemedText style={themedStyles.labelText}>{label}</ThemedText>
                <ThemedText style={themedStyles.asterisk}>*</ThemedText>
            </View>
            <View style={themedStyles.inputWrapper}>
                {prefix && (
                    <ThemedText style={themedStyles.prefixText}>{prefix}</ThemedText>
                )}
                <TextInput
                    style={[
                        themedStyles.input,
                        prefix && themedStyles.inputWithPrefix,
                        suffix && themedStyles.inputWithSuffix,
                    ]}
                    placeholder={placeholder}
                    placeholderTextColor={ThemedColor.caption}
                    value={value}
                    onChangeText={onChangeText}
                    {...inputProps}
                />
                {suffix && (
                    <View style={themedStyles.suffixContainer}>
                        {suffix}
                    </View>
                )}
            </View>
            {showError && error && (
                <ThemedText style={themedStyles.errorText}>
                    {error}
                </ThemedText>
            )}
            {helperText && !error && (
                <ThemedText style={themedStyles.helperText}>
                    {helperText}
                </ThemedText>
            )}
        </View>
    );
});

const styles = (ThemedColor: ReturnType<typeof useThemeColor>) => StyleSheet.create({
    fieldContainer: {
        gap: 4,
    },
    labelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    labelText: {
        fontSize: 12,
        fontFamily: 'Outfit',
        fontWeight: '500',
        opacity: 0.7,
    },
    asterisk: {
        fontSize: 14,
        fontFamily: 'Outfit',
        fontWeight: '500',
        color: ThemedColor.error,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 2,
        borderBottomColor: ThemedColor.bottomBorder,
        position: 'relative',
    },
    prefixText: {
        fontSize: 20,
        fontFamily: 'Outfit',
        fontWeight: '500',
        marginRight: 4,
    },
    input: {
        flex: 1,
        fontSize: 20,
        fontFamily: 'Outfit',
        paddingVertical: 16,
        color: ThemedColor.text,
    },
    inputWithPrefix: {
        paddingLeft: 0,
    },
    inputWithSuffix: {
        paddingRight: 60,
    },
    suffixContainer: {
        position: 'absolute',
        right: 20,
        top: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
    },
    errorText: {
        fontSize: 14,
        fontFamily: 'Outfit',
        marginTop: 4,
        marginLeft: 4,
        color: ThemedColor.error,
    },
    helperText: {
        fontSize: 14,
        fontFamily: 'Outfit',
        marginTop: 4,
        marginLeft: 4,
        color: ThemedColor.caption,
    },
});
