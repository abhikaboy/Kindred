import { StyleSheet, View } from "react-native";
import React from "react";
import CachedImage from "../CachedImage";
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
            <CachedImage 
                source={{ uri: icon }}
                style={{ width: sizeOfIcon[size], height: sizeOfIcon[size], borderRadius: 100 }}
                variant="thumbnail"
                cachePolicy="memory-disk"
            />
        </View>
    );
};

export default PreviewIcon;

const styles = StyleSheet.create({});
