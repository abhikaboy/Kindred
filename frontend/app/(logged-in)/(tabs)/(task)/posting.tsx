import { View, Text, Dimensions } from "react-native";
import React, { useRef, useState } from "react";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import { CameraView, CameraType, FlashMode, useCameraPermissions } from "expo-camera";
import { PermissionStatus } from "expo-camera";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColor } from "@/hooks/useThemeColor";
import { router } from "expo-router";

export default function Posting() {
    const insets = useSafeAreaInsets();
    const [facing, setFacing] = useState<CameraType>("back");
    const [permission, requestPermission] = useCameraPermissions();
    const camera = useRef<CameraView>(null);
    const [photo, setPhoto] = useState<string | null>(null);
    const [flash, setFlash] = useState<FlashMode>("off");
    let ThemedColor = useThemeColor();

    const takePicture = async () => {
        const photo = await camera.current?.takePictureAsync();
        setPhoto(photo?.uri);
    };
    return (
        <ThemedView>
            {permission?.status !== PermissionStatus.GRANTED && (
                <>
                    <ThemedText type="default" style={{ marginTop: insets.top }}>
                        Please grant camera permission to continue.
                    </ThemedText>
                    <PrimaryButton onPress={requestPermission} title="Grant Permission" />
                </>
            )}
            {permission?.status === PermissionStatus.GRANTED && (
                <>
                    <CameraView
                        style={{ width: "100%", height: Dimensions.get("window").height * 0.7, borderRadius: 12 }}
                        facing={facing}
                        ref={camera}
                        flashMode={flash}
                    />
                    <View
                        style={{
                            width: "100%",
                            flexDirection: "row",
                            justifyContent: "space-between",
                            alignItems: "center",
                            paddingVertical: 12,
                            paddingHorizontal: HORIZONTAL_PADDING,
                        }}>
                        <Ionicons
                            name={flash === "off" ? "flash-outline" : "flash-off-outline"}
                            size={24}
                            color={ThemedColor.primary}
                            onPress={() => setFlash(flash === "off" ? "on" : "off")}
                        />
                        <PrimaryButton onPress={takePicture} title="Take Picture" style={{ width: "60%" }} />
                        <Ionicons
                            name="camera-reverse-outline"
                            size={32}
                            color={ThemedColor.primary}
                            onPress={() => setFacing(facing === "back" ? "front" : "back")}
                        />
                    </View>
                    <PrimaryButton
                        ghost
                        title="Post Without Photo"
                        onPress={() => {
                            router.push("/(logged-in)/(tabs)/(task)/index");
                        }}
                    />
                </>
            )}
        </ThemedView>
    );
}
