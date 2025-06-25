import { View, Text, Dimensions, Image } from "react-native";
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
                                    <PrimaryButton onPress={retakePhoto} title="Retake" style={{ flex: 1 }} />
                                    <Ionicons
                                        name="library-outline"
                                        size={32}
                                        color={ThemedColor.primary}
                                        onPress={pickImage}
                                    />
                                </View>
                                <PrimaryButton onPress={continueWithPhoto} title="Continue" style={{ width: "100%" }} />
                            </>
                        ) : (
                            // Show when no photo is set (camera view)
                            <>
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                                    <Ionicons
                                        name={flash === "off" ? "flash-outline" : "flash-off-outline"}
                                        size={24}
                                        color={ThemedColor.primary}
                                        onPress={() => setFlash(flash === "off" ? "on" : "off")}
                                    />
                                    <PrimaryButton
                                        onPress={takePicture}
                                        title="Take Picture"
                                        style={{ width: "60%" }}
                                    />
                                    <Ionicons
                                        name="camera-reverse-outline"
                                        size={32}
                                        color={ThemedColor.primary}
                                        onPress={() => setFacing(facing === "back" ? "front" : "back")}
                                    />
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
                                    <Ionicons
                                        name="library-outline"
                                        size={32}
                                        color={ThemedColor.primary}
                                        onPress={pickImage}
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
