import { StyleSheet, View, Image, Pressable, useColorScheme, Dimensions } from "react-native";
import React from "react";
import { ThemedText } from "../ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";

type Props = {
    onPress: () => void;
    showBadge?: boolean;
};

const TutorialCard = ({ onPress, showBadge = false }: Props) => {
    const ThemedColor = useThemeColor();
    const colorScheme = useColorScheme();

    return (
        <Pressable 
            style={[styles.container, { 
                backgroundColor: ThemedColor.lightened,
            }]}
            onPress={onPress}
        >
            {showBadge && (
                <View
                    style={{
                        width: 16,
                        height: 16,
                        backgroundColor: ThemedColor.error,
                        borderRadius: 20,
                        position: "absolute",
                        right: -8,
                        top: -8,
                        zIndex: 99,
                    }}
                />
            )}
            <View style={styles.imageContainer}>
                <Image
                    source={require('@/assets/images/169.Check.png')}
                    style={[
                        styles.image,
                        colorScheme === 'dark' && styles.imageInverted
                    ]}
                    resizeMode="contain"
                />
            </View>
            
            <View style={styles.textContainer}>
                <View style={styles.textContent}>
                    <ThemedText style={[styles.welcomeText, { color: ThemedColor.primary }]}>
                        Welcome to Kindred!{' '}
                    </ThemedText>
                    <ThemedText style={styles.descriptionText}>
                        Click here for a short demo how kindred's todolist works (2 minutes).
                    </ThemedText>
                </View>
                <ThemedText style={[styles.arrow, { color: ThemedColor.primary }]}>
                    →
                </ThemedText>
            </View>
        </Pressable>
    );
};

export default TutorialCard;

const styles = StyleSheet.create({
    container: {
        borderRadius: 12,
        padding: 16,
        gap: 16,
        width: '100%',
        position: 'relative',
        overflow: 'visible',
        zIndex: 100,
    },
    imageContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
    },
    image: {
        width: 195,
        height: 195,
    },
    imageInverted: {
        tintColor: '#ffffff',
    },
    textContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        width: '100%',
    },
    textContent: {
        flex: 1,
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'flex-start',
    },
    welcomeText: {
        fontSize: 16,
        fontFamily: 'Outfit',
        fontWeight: '400',
        lineHeight: 22,
    },
    descriptionText: {
        fontSize: 16,
        fontFamily: 'Outfit',
        fontWeight: '400',
        lineHeight: 22,
    },
    arrow: {
        fontSize: 16,
        fontFamily: 'Outfit',
        fontWeight: '400',
    },
});

