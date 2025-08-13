import { View, Text, Dimensions, Image, TouchableOpacity, FlatList, ScrollView } from "react-native";
import React, { useRef, useState, useEffect } from "react";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import { CameraView, CameraType, FlashMode, useCameraPermissions } from "expo-camera";
import { PermissionStatus } from "expo-camera";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColor } from "@/hooks/useThemeColor";
import { router, useLocalSearchParams } from "expo-router";
import { BlurView } from "expo-blur";
import * as ImagePicker from "expo-image-picker";

export default function Posting() {
    const insets = useSafeAreaInsets();
    const [facing, setFacing] = useState<CameraType>("back");
    const [permission, requestPermission] = useCameraPermissions();
    const camera = useRef<CameraView>(null);
    const [photos, setPhotos] = useState<string[]>([]);
    const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
    const [flash, setFlash] = useState<FlashMode>("off");
    const [viewMode, setViewMode] = useState<"camera" | "preview">("camera");
    const flatListRef = useRef<FlatList>(null);
    let ThemedColor = useThemeColor();

    const params = useLocalSearchParams();
    const taskInfo = params.taskInfo ? JSON.parse(params.taskInfo as string) : null;

    useEffect(() => {
        if (viewMode === "preview" && flatListRef.current && photos.length > 0) {
            setTimeout(() => {
                flatListRef.current?.scrollToIndex({
                    index: currentPhotoIndex,
                    animated: false,
                });
            }, 100);
        }
    }, [viewMode, currentPhotoIndex]);

    const takePicture = async () => {
        const photo = await camera.current?.takePictureAsync();
        if (photo?.uri) {
            setPhotos([...photos, photo.uri]);
            setCurrentPhotoIndex(photos.length);
            setViewMode("preview");
        }
    };

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 1,
            allowsMultipleSelection: true,
        });
        if (!result.canceled && result.assets && result.assets.length > 0) {
            const newPhotos = result.assets.map((asset) => asset.uri);
            const previousLength = photos.length;
            setPhotos([...photos, ...newPhotos]);
            setCurrentPhotoIndex(previousLength);
            setViewMode("preview");
        }
    };

    const removePhoto = (index: number) => {
        const newPhotos = photos.filter((_, i) => i !== index);
        setPhotos(newPhotos);
        if (newPhotos.length === 0) {
            setViewMode("camera");
            setCurrentPhotoIndex(0);
        } else if (currentPhotoIndex >= newPhotos.length) {
            setCurrentPhotoIndex(newPhotos.length - 1);
        }
    };

    const continueWithPhotos = () => {
        router.push({
            pathname: "/posting/caption",
            params: {
                photos: JSON.stringify(photos),
                taskInfo: taskInfo ? JSON.stringify(taskInfo) : null,
            },
        });
    };

    const renderPhotoThumbnail = ({ item, index }: { item: string; index: number }) => (
        <TouchableOpacity
            onPress={() => {
                setCurrentPhotoIndex(index);
                setViewMode("preview");
            }}
            style={{ marginRight: 10, paddingTop: 8 }}>
            <View style={{ position: "relative" }}>
                <Image
                    source={{ uri: item }}
                    style={{
                        width: 60,
                        height: 60,
                        borderRadius: 8,
                        borderWidth: currentPhotoIndex === index && viewMode === "preview" ? 2 : 0,
                        borderColor: ThemedColor.tint || "#9333ea",
                    }}
                />
                <TouchableOpacity
                    onPress={(e) => {
                        e.stopPropagation();
                        removePhoto(index);
                    }}
                    style={{
                        position: "absolute",
                        top: -8,
                        right: -8,
                        backgroundColor: ThemedColor.text,
                        borderRadius: 12,
                        width: 24,
                        height: 24,
                        justifyContent: "center",
                        alignItems: "center",
                    }}>
                    <Ionicons name="close" size={16} color="#fff" />
                </TouchableOpacity>
            </View>
        </TouchableOpacity>
    );

    return (
        <ThemedView style={{ flex: 1 }}>
            {permission?.status !== PermissionStatus.GRANTED && (
                <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: HORIZONTAL_PADDING }}>
                    <ThemedText type="default" style={{ marginBottom: 20, textAlign: "center" }}>
                        Please grant camera permission to continue.
                    </ThemedText>
                    <PrimaryButton onPress={requestPermission} title="Grant Permission" />
                </View>
            )}
            {permission?.status === PermissionStatus.GRANTED && (
                <>
                    {viewMode === "preview" && photos.length > 0 ? (
                        <>
                            <FlatList
                                ref={flatListRef}
                                data={photos}
                                horizontal
                                pagingEnabled
                                showsHorizontalScrollIndicator={false}
                                onMomentumScrollEnd={(event) => {
                                    const index = Math.round(
                                        event.nativeEvent.contentOffset.x / Dimensions.get("window").width
                                    );
                                    setCurrentPhotoIndex(index);
                                }}
                                renderItem={({ item }) => (
                                    <View
                                        style={{
                                            width: Dimensions.get("window").width,
                                            height: Dimensions.get("window").height,
                                        }}>
                                        <Image
                                            source={{ uri: item }}
                                            style={{
                                                width: "100%",
                                                height: "100%",
                                                position: "absolute",
                                                top: 0,
                                                left: 0,
                                                zIndex: 2,
                                            }}
                                            resizeMode="contain"
                                        />
                                        <Image
                                            source={{ uri: item }}
                                            blurRadius={20}
                                            style={{
                                                width: "100%",
                                                height: "100%",
                                                position: "absolute",
                                                top: 0,
                                                left: 0,
                                            }}
                                            resizeMode="cover"
                                        />
                                    </View>
                                )}
                                keyExtractor={(item, index) => index.toString()}
                            />
                        </>
                    ) : (
                        <CameraView
                            style={{ width: "100%", height: Dimensions.get("window").height }}
                            facing={facing}
                            ref={camera}
                            flash={flash}
                        />
                    )}

                    {photos.length > 0 && (
                        <View
                            style={{
                                position: "absolute",
                                top: insets.top + 20,
                                right: 20,
                                backgroundColor: "rgba(0,0,0,0.6)",
                                paddingHorizontal: 12,
                                paddingVertical: 6,
                                borderRadius: 16,
                                zIndex: 10,
                            }}>
                            <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>
                                {viewMode === "preview"
                                    ? `${currentPhotoIndex + 1} / ${photos.length}`
                                    : `${photos.length} selected`}
                            </Text>
                        </View>
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
                            paddingBottom: insets.bottom + HORIZONTAL_PADDING,
                            backgroundColor: ThemedColor.background + "30",
                            position: "absolute",
                            bottom: 0,
                            zIndex: 10,
                        }}>
                        {photos.length > 0 && (
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                style={{ width: "100%", maxHeight: 88 }}
                                contentContainerStyle={{ paddingVertical: 8, alignItems: "center" }}>
                                <FlatList
                                    data={photos}
                                    renderItem={renderPhotoThumbnail}
                                    keyExtractor={(item, index) => index.toString()}
                                    horizontal
                                    scrollEnabled={false}
                                />
                                {viewMode === "preview" && (
                                    <TouchableOpacity
                                        onPress={pickImage}
                                        style={{
                                            width: 60,
                                            height: 60,
                                            borderRadius: 8,
                                            backgroundColor:
                                                ThemedColor.background === "#000"
                                                    ? "rgba(255,255,255,0.1)"
                                                    : "rgba(0,0,0,0.05)",
                                            justifyContent: "center",
                                            alignItems: "center",
                                            borderWidth: 1,
                                            borderColor:
                                                ThemedColor.background === "#000"
                                                    ? "rgba(255,255,255,0.3)"
                                                    : "rgba(0,0,0,0.1)",
                                            borderStyle: "dashed",
                                            marginLeft: 8,
                                        }}>
                                        <Ionicons
                                            name="add"
                                            size={28}
                                            color={ThemedColor.background === "#000" ? "#fff" : "#000"}
                                        />
                                    </TouchableOpacity>
                                )}
                            </ScrollView>
                        )}

                        {viewMode === "camera" ? (
                            <>
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 24 }}>
                                    <Ionicons
                                        name={flash === "off" ? "flash-outline" : "flash"}
                                        size={32}
                                        color={ThemedColor.background === "#000" ? "#fff" : "#000"}
                                        onPress={() => setFlash(flash === "off" ? "on" : "off")}
                                    />
                                    <View
                                        style={{
                                            borderRadius: 302,
                                            backgroundColor: "transparent",
                                            padding: 6,
                                            borderWidth: 2,
                                            borderColor: ThemedColor.background === "#000" ? "#ffffff" : "#000000",
                                        }}>
                                        <TouchableOpacity
                                            onPress={takePicture}
                                            style={{
                                                width: 64,
                                                height: 64,
                                                borderRadius: 32,
                                                backgroundColor:
                                                    ThemedColor.background === "#000" ? "#ffffff" : "#000000",
                                                justifyContent: "center",
                                                alignItems: "center",
                                            }}>
                                            {photos.length > 0 && (
                                                <View
                                                    style={{
                                                        position: "absolute",
                                                        top: -10,
                                                        right: -10,
                                                        backgroundColor: ThemedColor.tint || "#9333ea",
                                                        borderRadius: 12,
                                                        minWidth: 24,
                                                        height: 24,
                                                        justifyContent: "center",
                                                        alignItems: "center",
                                                        paddingHorizontal: 6,
                                                    }}>
                                                    <Text style={{ color: "#fff", fontSize: 12, fontWeight: "bold" }}>
                                                        {photos.length}
                                                    </Text>
                                                </View>
                                            )}
                                        </TouchableOpacity>
                                    </View>
                                    <Ionicons
                                        name="camera-reverse-outline"
                                        size={32}
                                        color={ThemedColor.background === "#000" ? "#fff" : "#000"}
                                        onPress={() => setFacing(facing === "back" ? "front" : "back")}
                                    />
                                    <Ionicons
                                        name="images-outline"
                                        size={32}
                                        color={ThemedColor.background === "#000" ? "#fff" : "#000"}
                                        onPress={pickImage}
                                    />
                                </View>

                                <View style={{ flexDirection: "row", alignItems: "center", gap: 12, width: "100%" }}>
                                    {photos.length > 0 && (
                                        <PrimaryButton
                                            onPress={continueWithPhotos}
                                            title={`Done (${photos.length})`}
                                            style={{ flex: 1 }}
                                        />
                                    )}
                                    <PrimaryButton
                                        ghost
                                        textStyle={{ color: ThemedColor.text }}
                                        title="Cancel"
                                        onPress={() => router.back()}
                                        style={{ flex: photos.length > 0 ? 0 : 1 }}
                                    />
                                    <PrimaryButton
                                        ghost
                                        textStyle={{ color: ThemedColor.text }}
                                        title="Skip"
                                        onPress={() => router.push("/posting/caption")}
                                        style={{ flex: photos.length > 0 ? 0 : 1 }}
                                    />
                                </View>
                            </>
                        ) : (
                            <>
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 12, width: "100%" }}>
                                    <PrimaryButton
                                        onPress={continueWithPhotos}
                                        title={`Done with ${photos.length} photo${photos.length !== 1 ? "s" : ""}`}
                                        style={{
                                            flex: 1,
                                        }}
                                    />
                                </View>

                                <TouchableOpacity
                                    onPress={() => setViewMode("camera")}
                                    style={{
                                        flexDirection: "row",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        width: "100%",
                                        paddingVertical: 12,
                                        paddingHorizontal: 20,
                                        backgroundColor: ThemedColor.primaryPressed,
                                        borderRadius: 8,
                                        borderWidth: 1,
                                        borderColor: ThemedColor.tint || "#9333ea",
                                        borderStyle: "dashed",
                                    }}>
                                    <Ionicons name="camera-outline" size={20} color={ThemedColor.tint || "#9333ea"} />
                                    <Text
                                        style={{
                                            marginLeft: 8,
                                            color: ThemedColor.tint || "#9333ea",
                                            fontSize: 16,
                                            fontWeight: "600",
                                        }}>
                                        Take More Photos
                                    </Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </BlurView>
                </>
            )}
        </ThemedView>
    );
}
