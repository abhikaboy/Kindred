import { StyleSheet, Image, View } from "react-native";
import React from "react";

type Props = {
    icon: string;
};
const PreviewIcon = ({ icon }: Props) => {
    return (
        <View>
            <Image src={icon} style={{ width: 64, height: 64, borderRadius: 100 }} />
        </View>
    );
};

export default PreviewIcon;

const styles = StyleSheet.create({});
