import { View, Dimensions, ScrollView } from "react-native";
import React from "react";
import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";
import ContactCard from "@/components/cards/ContactCard";
import { Icons } from "@/constants/Icons";

export default function Dev2() {
    const [searchTerm, setSearchTerm] = React.useState("");
    return (
        <View
            style={{
                backgroundColor: Colors.dark.background,
                height: Dimensions.get("screen").height,
                flex: 1,
                paddingTop: Dimensions.get("screen").height * 0.1,
                paddingHorizontal: 24,
                gap: 16,
            }}>
            <ThemedText type="title" style={{ fontWeight: "700" }}>
                Development Components 2 - Cards
            </ThemedText>
            <ScrollView
                contentContainerStyle={{
                    gap: 16,
                }}>
                <ScrollView horizontal style={{ display: "flex", flexDirection: "row", gap: 16 }}>
                    <ContactCard name="Abhik Ray" icon={Icons.luffy} handle="beak" following={true} />
                    <ContactCard name="Lok Ye" icon={Icons.lokye} handle="lokye" following={false} />
                    <ContactCard name="Coffee" icon={Icons.coffee} handle="coffee" following={true} />
                    <ContactCard name="Latte" icon={Icons.latte} handle="latte" following={false} />
                </ScrollView>
            </ScrollView>
        </View>
    );
}
