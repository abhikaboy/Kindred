import React = require("react");
import { StyleSheet } from "react-native";

import ParallaxScrollView from "@/components/ParallaxScrollView";
import { ThemedText } from "@/components/ThemedText";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { Link } from "expo-router";

export default function Playground() {
    return (
        <ParallaxScrollView
            headerBackgroundColor={{ light: "#D0D0D0", dark: "#353636" }}
            headerImage={
                <IconSymbol
                    size={310}
                    color="#808080"
                    name="chevron.left.forwardslash.chevron.right"
                    style={styles.headerImage}
                />
            }>
            <ThemedText style={{ fontFamily: "Outfit" }}>This is the content of the playground page.</ThemedText>
            <Link href={"/Dev1"} style={{
                color: "#fff",
                fontSize: 16,
            }}>Development Environment 1</Link>
            <Link href={"/Dev2"} style={{
                color: "#fff",
                fontSize: 16,
            }}>Development Environment 2</Link>
            <Link href={"/Dev3"} style={{
                color: "#fff",
                fontSize: 16,
            }}>Development Environment 3</Link>
        </ParallaxScrollView>
    );
}

const styles = StyleSheet.create({
    headerImage: {
        color: "#808080",
        bottom: -90,
        left: -35,
        position: "absolute",
    },
    titleContainer: {
        flexDirection: "row",
        gap: 8,
    },
});
