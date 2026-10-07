import React from "react";
import { Dimensions, Image, StyleProp, View, ViewStyle } from "react-native";
import { Colors } from "@/constants/Colors";
import { ThemedText } from "@/components/ThemedText";

type Props = {
    /** Merged over the card's own style, e.g. to seat it under the safe area. */
    style?: StyleProp<ViewStyle>;
};

// The landing hero card is deliberately the dark palette in every theme.
const heroCardBg = Colors.dark.background;
const heroCardText = Colors.dark.text;

/**
 * The dark rounded "kindred" card from the landing screen. Shared by the
 * login screen and the guest account overlay so both read as the same moment.
 */
export function AuthHeroCard({ style }: Props) {
    return (
        <View
            style={[
                {
                    backgroundColor: heroCardBg,
                    height: Dimensions.get("screen").height * 0.4,
                    width: "95%",
                    alignSelf: "center",
                    borderRadius: 56,
                    marginTop: 12,
                    flexDirection: "column",
                    alignItems: "center",
                    paddingTop: Dimensions.get("screen").height * 0.06,
                },
                style,
            ]}>
            <ThemedText
                type="titleFraunces"
                style={{
                    color: heroCardText,
                    letterSpacing: -2,
                    justifyContent: "center",
                    alignItems: "center",
                    textAlign: "center",
                    marginTop: Dimensions.get("screen").height * 0.02,
                    fontSize: 64,
                }}>
                kindred
            </ThemedText>
            <View
                style={{
                    paddingHorizontal: 48,
                    marginTop: 8,
                }}>
                <ThemedText
                    type="defaultSemiBold"
                    style={{
                        color: heroCardText,
                        fontSize: 16,
                        textAlign: "center",
                        lineHeight: 22,
                        opacity: 0.8,
                    }}>
                    Get more done with the people who keep you going.
                </ThemedText>
            </View>
            <View style={{ marginTop: 12 }}>
                <Image
                    source={require("../../assets/images/Checkmark.png")}
                    style={{
                        width: 50,
                        resizeMode: "contain",
                    }}
                />
            </View>
        </View>
    );
}
