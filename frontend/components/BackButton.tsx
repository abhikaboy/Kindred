import { StyleSheet, TouchableOpacity, View } from "react-native";
import React from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";

export default function BackButton() {
    const router = useRouter();

    // only render if we're not in (tabs) or root
    const isRoot = router.canGoBack();

    const handleBack = () => {
        router.back();
    };

    return (
        isRoot && (
            <TouchableOpacity
                onPress={handleBack}
                style={{
                    marginLeft: 4,
                }}>
                <Ionicons name="chevron-back" size={28} color="white" />
            </TouchableOpacity>
        )
    );
}

const styles = StyleSheet.create({});
