import { StyleSheet, Image, View } from "react-native";
import React from "react";
type Size = "small" | "smallMedium" | "medium" | "large" ;

type Props = {
    icon: string;
    size: Size;
};

const sizeOfIcon = {
    small: 35,
    smallMedium: 42,
    medium: 48,
    large: 64,
};
const PreviewIcon = ({ icon, size }: Props) => {
    return (
        <View>
            <Image src={icon} style={{ width: sizeOfIcon[size], height: sizeOfIcon[size], borderRadius: 100 }} />
        </View>
    );
};

export default PreviewIcon;

const styles = StyleSheet.create({});
