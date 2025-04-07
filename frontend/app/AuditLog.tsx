import { Dimensions, StyleSheet, Text, View } from "react-native";
import React from "react";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useRequest } from "@/hooks/useRequest";
import { ScrollView } from "react-native";
import { getThemedColor } from "@/constants/Colors";
import { useThemeColor } from "@/hooks/useThemeColor";

type Props = {};

const AuditLog = (props: Props) => {
    const { history, errorHistory } = useRequest();
    let ThemedColor = useThemeColor();

    console.log(history());
    console.log(errorHistory());

    return (
        <ThemedView style={{ paddingTop: Dimensions.get("screen").height * 0.12, paddingHorizontal: 24 }}>
            <ScrollView
                style={{
                    height: "100%",
                }}>
                <ThemedText type="title">Audit Log</ThemedText>
                {history().map((item, index) => {
                    return (
                        <View
                            style={{
                                backgroundColor: ThemedColor.lightened,
                                padding: 16,
                                boxShadow: "0px 0px 10px rgba(0,0,0,0.1)",
                                borderRadius: 12,
                                marginBottom: 16,
                            }}>
                            {Object.keys(item).map((key) => {
                                return (
                                    <ScrollView>
                                        <ThemedText type="defaultSemiBold">{key}</ThemedText>;
                                        <ThemedText type="default">{JSON.stringify(item[key])}</ThemedText>;
                                    </ScrollView>
                                );
                            })}
                        </View>
                    );
                })}
            </ScrollView>
        </ThemedView>
    );
};

export default AuditLog;

const styles = StyleSheet.create({});
