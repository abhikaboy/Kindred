import { Dimensions, StyleSheet, Text, View, ScrollView } from "react-native";
import React from "react";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import ActivityPoint from "@/components/profile/ActivityPoint";

type Props = {};

const Activity = (props: Props) => {
    return (
        <ThemedView>
            <ScrollView
                contentContainerStyle={{
                    gap: 16,
                    paddingHorizontal: 24,
                    // alignItems: "center",
                    // alignSelf: "center",
                }}
                style={{
                    top: Dimensions.get("window").height * 0.15,
                    flex: 1,
                    flexDirection: "column",
                }}>
                <ThemedText
                    type="title"
                    style={{
                        textAlign: "center",
                    }}>
                    Coffee's Activity
                </ThemedText>
                <View style={{ flexDirection: "column", gap: 12 }}>
                    <View style={{ flex: 1, flexDirection: "row", gap: 16, alignSelf: "center" }}>
                        <ThemedText type="lightBody" style={{ color: "white" }}>
                            This month's average:
                        </ThemedText>
                        <ActivityPoint level={4} />
                    </View>
                    <View style={{ flex: 1, flexDirection: "row", gap: 16, alignSelf: "center" }}>
                        <ThemedText type="lightBody" style={{ color: "white" }}>
                            Last month's average:
                        </ThemedText>
                        <ActivityPoint level={3} />
                    </View>
                </View>
                <View style={{ marginTop: Dimensions.get("window").height * 0.05, gap: 16 }}>
                    <ThemedText type="subtitle" style={{ textAlign: "center" }}>
                        February
                    </ThemedText>
                    <View>
                        <View style={{ flexWrap: "wrap", gap: 8, flexDirection: "row" }}>
                            {[
                                1, 2, 3, 3, 2, 1, 4, 4, 1, 2, 4, 2, 3, 1, 4, 3, 1, 1, 1, 1, 2, 3, 4, 2, 1, 2, 3, 4, 2,
                                3, 1, 3, 1,
                            ].map((item, index) => (
                                <ActivityPoint key={index} level={item} />
                            ))}
                        </View>
                    </View>
                </View>
            </ScrollView>
        </ThemedView>
    );
};

export default Activity;

const styles = StyleSheet.create({});
