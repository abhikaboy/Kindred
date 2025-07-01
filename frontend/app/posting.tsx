import { View, Text, Dimensions, Image, TouchableOpacity } from "react-native";
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
import { BlurView } from "expo-blur";
import * as ImagePicker from "expo-image-picker";

export default function Posting() {
    const insets = useSafeAreaInsets();
    const [facing, setFacing] = useState<CameraType>("back");
    const [permission, requestPermission] = useCameraPermissions();
    const camera = useRef<CameraView>(null);
    const [photo, setPhoto] = useState<string | null>(null);
    const [flash, setFlash] = useState<FlashMode>("off");
    const [torch, setTorch] = useState<boolean>(false);
    let ThemedColor = useThemeColor();

    const takePicture = async () => {
        const photo = await camera.current?.takePictureAsync();
        setPhoto(photo?.uri);
    };
    const handlePictureSaved = (photo: any) => {
        console.log(photo);
    };

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 1,
        });
        if (!result.canceled && result.assets && result.assets.length > 0) {
            setPhoto(result.assets[0].uri);
        }
    };

    const retakePhoto = () => {
        setPhoto(null);
    };

    const continueWithPhoto = () => {
        // Navigate to next screen with the photo
        router.back();
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
                    {photo ? (
                        <>
                            <Image
                                source={{ uri: photo }}
                                style={{
                                    width: "100%",
                                    height: Dimensions.get("window").height,
                                    borderRadius: 12,
                                    position: "absolute",
                                    top: 0,
                                    left: 0,
                                    zIndex: 2,
                                }}
                                resizeMode="contain"
                            />
                            <Image
                                source={{ uri: photo }}
                                blurRadius={20}
                                style={{
                                    width: "100%",
                                    height: Dimensions.get("window").height,
                                    borderRadius: 12,
                                    position: "absolute",
                                    top: 0,
                                    left: 0,
                                }}
                                resizeMode="cover"
                            />
                        </>
                    ) : (
                        <CameraView
                            style={{ width: "100%", height: Dimensions.get("window").height, borderRadius: 12 }}
                            facing={facing}
                            ref={camera}
                            flash={flash}
                            torchMode={torch ? "on" : "off"}
                        />
                    )}
                    <BlurView
                        intensity={30}
                        style={{
                            width: "100%",
                            flexDirection: "column",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 12,
                            padding: HORIZONTAL_PADDING,
                            backgroundColor: ThemedColor.background + "30",
                            position: "absolute",
                            bottom: 0,
                            zIndex: 10,
                        }}>
                        {photo ? (
                            // Show when photo is set
                            <>
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                                    <PrimaryButton
                                        onPress={continueWithPhoto}
                                        title="Continue"
                                        style={{ width: "100%" }}
                                    />
                                </View>
                                <PrimaryButton
                                    onPress={retakePhoto}
                                    ghost
                                    title="Retake"
                                    style={{ flex: 1 }}
                                    textStyle={{ color: "#fff" }}
                                />
                            </>
                        ) : (
                            // Show when no photo is set (camera view)
                            <>
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 24 }}>
                                    <Ionicons
                                        name="flashlight-outline"
                                        size={32}
                                        color="#ffffff00"
                                        onPress={() => setTorch(!torch)}
                                    />
                                    <Ionicons
                                        name={flash === "off" ? "flash-outline" : "flash-off-outline"}
                                        size={32}
                                        color="#fff"
                                        onPress={() => setFlash(flash === "off" ? "on" : "off")}
                                    />
                                    <View
                                        style={{
                                            borderRadius: 302,
                                            backgroundColor: "#ffffff00",
                                            padding: 6,
                                            borderWidth: 2,
                                            borderColor: "#ffffff",
                                        }}>
                                        <TouchableOpacity
                                            onPress={takePicture}
                                            style={{
                                                width: 64,
                                                height: 64,
                                                borderRadius: 32,
                                                backgroundColor: "#ffffff",
                                                justifyContent: "center",
                                                alignItems: "center",
                                            }}
                                        />
                                    </View>
                                    <Ionicons
                                        name="camera-reverse-outline"
                                        size={32}
                                        color="#fff"
                                        onPress={() => setFacing(facing === "back" ? "front" : "back")}
                                    />

                                    <Ionicons name="library-outline" size={32} color="#fff" onPress={pickImage} />
                                </View>
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                                    <PrimaryButton
                                        ghost
                                        textStyle={{ color: "#fff" }}
                                        title="Post Without Photo"
                                        onPress={() => {
                                            router.back();
                                        }}
                                    />
                                </View>
                            </>
                        )}
                    </BlurView>
                </>
            )}
        </ThemedView>
    );
}
