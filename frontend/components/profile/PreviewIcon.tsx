import { StyleSheet, View } from "react-native";
import { Image  } from "expo-image";
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
            <Image 
            source={{ uri: icon }}
            style={{ width: sizeOfIcon[size], height: sizeOfIcon[size], borderRadius: 100 }}
            contentFit="cover"
            placeholder={"https://adexusa.com/wp-content/uploads/2022/11/Floor-Square-en-rWt2QxfUBxF2UvRz.jpg"}
            cachePolicy="memory"
            decodeFormat="rgb"
            allowDownscaling={true}
        />
        </View>
    );
};

export default PreviewIcon;

const styles = StyleSheet.create({});
