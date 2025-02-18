import { View, Dimensions, ScrollView } from "react-native";
import React from "react";
import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";

import PrimaryButton from "@/components/inputs/PrimaryButton";
import { SearchBox } from "@/components/SearchBox";
import FollowButton from "@/components/inputs/FollowButton";
import SendButton from "@/components/inputs/SendButton";
import NextButton from "@/components/inputs/NextButton";
import ThemedSwitch from "@/components/inputs/ThemedSwitch";
import TrafficLight from "@/components/inputs/TrafficLight";
import ThemedSlider from "@/components/inputs/ThemedSlider";

export default function Dev1() {
    const [searchTerm, setSearchTerm] = React.useState("");
    return (
        <View
            style={{
                backgroundColor: Colors.dark.background,
                height: Dimensions.get("screen").height,
                flex: 1,
                paddingTop: Dimensions.get("screen").height * 0.12,
                paddingHorizontal: 24,
                gap: 16,
            }}>
            <ThemedText type="title" style={{ fontWeight: "700" }}>
                Development Components 1 - Inputs
            </ThemedText>
            <ScrollView
                contentContainerStyle={{
                    gap: 16,
                }}>
                <PrimaryButton title="Button" onPress={() => {}} />
                <SearchBox
                    value={searchTerm}
                    placeholder="Search"
                    onChangeText={(text) => {
                        setSearchTerm(text);
                    }}
                    onSubmit={() => {}}
                    recent={true}
                    name="test"
                />
                <SearchBox
                    value={searchTerm}
                    placeholder="Search"
                    onChangeText={(text) => {
                        setSearchTerm(text);
                    }}
                    onSubmit={() => {}}
                />
                <FollowButton following />
                <FollowButton following={false} />
                <View style={{ display: "flex", flexDirection: "row", gap: 16, margin: "auto" }}>
                    <View style={{ width: "80%" }}>
                        <SearchBox
                            value={searchTerm}
                            placeholder="Search"
                            onChangeText={(text) => {
                                setSearchTerm(text);
                            }}
                            onSubmit={() => {}}
                        />
                    </View>
                    <SendButton onSend={() => {}} />
                </View>
                <NextButton onPress={() => {}} />
                <ThemedSwitch />
                <TrafficLight />
                <ThemedSlider />
            </ScrollView>
        </View>
    );
}
