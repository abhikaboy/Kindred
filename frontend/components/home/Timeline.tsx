import { View } from "react-native";
import { ThemedText } from "../ThemedText";

export default function Timeline() {
    return (
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            {[...Array(8)].map((_, index) => (
                <View key={index} style={{ alignItems: "left", gap: 8 }}>
                    <View
                        style={{
                            width: 1,
                            height: 50,
                            backgroundColor: "gray",
                        }}
                    />
                    <ThemedText
                        type="default"
                        style={{
                            fontSize: 12,
                            transform: [{ translateX: -4 }],
                        }}>
                        {index + 1} PM
                    </ThemedText>
                </View>
            ))}
        </View>
    );
}
