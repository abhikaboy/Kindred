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
import { useMediaLibrary } from "@/hooks/useMediaLibrary";

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
    const [dualPhoto, setDualPhoto] = useState<string | null>(null);
    const [isCapturingDual, setIsCapturingDual] = useState(false);
    const [dualModeEnabled, setDualModeEnabled] = useState(true); // Default to enabled
    const [capturingMessage, setCapturingMessage] = useState<string>("");
    const [justCapturedPhoto, setJustCapturedPhoto] = useState<string | null>(null);
    const [countdown, setCountdown] = useState<number>(0);
    const [isCameraReady, setIsCameraReady] = useState(false);
    const [waitingForCamera, setWaitingForCamera] = useState(false);
    const cameraReadyRef = useRef(false);
    const previewCamera = useRef<CameraView>(null);
    let ThemedColor = useThemeColor();

    const { pickImage: pickImageFromLibrary } = useMediaLibrary();

    const params = useLocalSearchParams();
    const taskInfo = params.taskInfo ? JSON.parse(params.taskInfo as string) : null;

    // BeReal-style capture messages
    const backCameraMessages = [
        "Show us what you're up to!",
        "What's happening?",
        "Capture the moment!",
        "What are you doing?",
    ];
    const frontCameraMessages = [
        "Smile!",
        "Say cheese!",
        "Look at the camera!",
        "Show your reaction!",
    ];

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
        try {
            const photo = await camera.current?.takePictureAsync({
                quality: 0.5,
            });
            
            if (!photo?.uri) {
                console.error("Failed to capture photo - no URI returned");
                return;
            }
            
            setPhotos([...photos, photo.uri]);
            setCurrentPhotoIndex(photos.length);
            
            // Automatically capture dual photo if dual mode is enabled
            if (dualModeEnabled) {
                // Show the just-captured photo with a message
                setJustCapturedPhoto(photo.uri);
                
                // Get appropriate message based on which camera will capture next
                const messages = facing === "back" ? frontCameraMessages : backCameraMessages;
                const randomMessage = messages[Math.floor(Math.random() * messages.length)];
                setCapturingMessage(randomMessage);
                
                await captureDualPhotoAutomatic();
            }
            
            // Only switch to preview after dual capture is complete
            setViewMode("preview");
        } catch (error) {
            console.error("Error in takePicture:", error);
            // Still try to go to preview if we have photos
            if (photos.length > 0) {
                setViewMode("preview");
            }
        }
    };

    const pickImage = async () => {
        const result = await pickImageFromLibrary({
            allowsMultipleSelection: true,
            quality: 0.5,
        });
        
        if (result && !result.canceled && result.assets && result.assets.length > 0) {
            const newPhotos = result.assets.map((asset) => asset.uri);
            const previousLength = photos.length;
            setPhotos([...photos, ...newPhotos]);
            setCurrentPhotoIndex(previousLength);
            setViewMode("preview");
        }
    };

    const captureDualPhotoAutomatic = async () => {
        if (isCapturingDual) return;
        
        setIsCapturingDual(true);
        let isCancelled = false;
        
        try {
            // Switch to opposite camera immediately
            const dualFacing: CameraType = facing === "back" ? "front" : "back";
            setFacing(dualFacing);
            cameraReadyRef.current = false;
            setIsCameraReady(false);
            setWaitingForCamera(true);
            
            // Wait for camera ready callback using ref
            let attempts = 0;
            while (!cameraReadyRef.current && attempts < 50 && !isCancelled) { // Max 5 seconds wait
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }
            
            if (isCancelled) return;
            
            if (!cameraReadyRef.current) {
                console.error("Camera did not become ready in time");
                return;
            }
            
            setWaitingForCamera(false);
            
            // Additional stabilization time after camera is ready
            await new Promise(resolve => setTimeout(resolve, 800));
            
            if (isCancelled) return;
            
            // Start countdown from 3
            for (let i = 3; i > 0; i--) {
                if (isCancelled) return;
                setCountdown(i);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            if (isCancelled) return;
            setCountdown(0);
            
            // Extra delay after countdown before capture
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Check if preview camera ref is valid (we use preview camera during dual capture)
            if (!previewCamera.current) {
                console.error("Preview camera ref is null, cannot capture dual photo");
                return;
            }
            
            console.log("Attempting to capture dual photo...");
            
            // Capture photo from the preview camera ref
            const photo = await previewCamera.current.takePictureAsync({
                quality: 0.5,
            });
            
            console.log("Dual photo captured:", photo?.uri ? "success" : "failed");
            
            if (photo?.uri && !isCancelled) {
                setDualPhoto(photo.uri);
            }
            
        } catch (error) {
            console.error("Failed to capture dual photo:", error);
        } finally {
            // Clean up all states - no need to switch camera back since we're going to preview
            if (!isCancelled) {
                setIsCapturingDual(false);
                setJustCapturedPhoto(null);
                setCapturingMessage("");
                setCountdown(0);
                setWaitingForCamera(false);
            }
        }
    };

    const captureDualPhoto = async () => {
        if (isCapturingDual) return;
        
        setIsCapturingDual(true);
        const wasInPreview = viewMode === "preview";
        
        try {
            // If in preview, temporarily switch to camera
            if (wasInPreview) {
                setViewMode("camera");
                await new Promise(resolve => setTimeout(resolve, 300));
            }
            
            // Switch to opposite camera
            const dualFacing: CameraType = facing === "back" ? "front" : "back";
            setFacing(dualFacing);
            
            // Wait for camera to switch
            await new Promise(resolve => setTimeout(resolve, 800));
            
            // Capture photo
            const photo = await camera.current?.takePictureAsync({
                quality: 0.5,
            });
            
            if (photo?.uri) {
                setDualPhoto(photo.uri);
            }
            
            // Return to preview if we were there (no need to switch camera back)
            if (wasInPreview) {
                setViewMode("preview");
            }
        } catch (error) {
            console.error("Failed to capture dual photo:", error);
        } finally {
            setIsCapturingDual(false);
        }
    };

    const swapPhotos = () => {
        if (!dualPhoto || photos.length === 0) return;
        
        // Swap the main photo with the dual photo
        const currentMainPhoto = photos[currentPhotoIndex];
        const newPhotos = [...photos];
        newPhotos[currentPhotoIndex] = dualPhoto;
        setPhotos(newPhotos);
        setDualPhoto(currentMainPhoto);
    };

    const removeDualPhoto = () => {
        setDualPhoto(null);
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
                dualPhoto: dualPhoto || "",
                taskInfo: taskInfo ? JSON.stringify(taskInfo) : null,
            },
        });
    };

    const skipPhotos = () => {
        router.push({
            pathname: "/posting/caption",
            params: {
                photos: JSON.stringify([]),
                dualPhoto: "",
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
                                        {dualPhoto && (
                                            <View
                                                style={{
                                                    position: "absolute",
                                                    top: insets.top + 20,
                                                    left: 20,
                                                    width: Dimensions.get("window").width * 0.3,
                                                    aspectRatio: 3 / 4,
                                                    zIndex: 10,
                                                }}>
                                                <TouchableOpacity
                                                    onPress={swapPhotos}
                                                    activeOpacity={1}
                                                    style={{
                                                        width: "100%",
                                                        height: "100%",
                                                        borderRadius: 12,
                                                        borderWidth: 3,
                                                        borderColor: "#fff",
                                                        overflow: "hidden",
                                                        shadowColor: "#000",
                                                        shadowOffset: { width: 0, height: 2 },
                                                        shadowOpacity: 0.3,
                                                        shadowRadius: 4,
                                                        elevation: 5,
                                                    }}>
                                                    <Image
                                                        source={{ uri: dualPhoto }}
                                                        style={{
                                                            width: "100%",
                                                            height: "100%",
                                                        }}
                                                        resizeMode="cover"
                                                    />
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    onPress={removeDualPhoto}
                                                    style={{
                                                        position: "absolute",
                                                        top: -8,
                                                        right: -8,
                                                        width: 28,
                                                        height: 28,
                                                        borderRadius: 14,
                                                        backgroundColor: "#000",
                                                        borderWidth: 2,
                                                        borderColor: "#fff",
                                                        justifyContent: "center",
                                                        alignItems: "center",
                                                        zIndex: 11,
                                                    }}>
                                                    <Ionicons name="close" size={18} color="#fff" />
                                                </TouchableOpacity>
                                            </View>
                                        )}
                                    </View>
                                )}
                                keyExtractor={(item, index) => index.toString()}
                            />
                        </>
                    ) : (
                        <>
                            {/* Main camera view - only render when NOT capturing dual */}
                            {!isCapturingDual && (
                                <View style={{ 
                                    width: "100%", 
                                    height: Dimensions.get("window").height,
                                }}>
                                    <CameraView
                                        style={{ width: "100%", height: "100%" }}
                                        facing={facing}
                                        ref={camera}
                                        flash={flash}
                                        zoom={0}
                                        selectedLens="builtInWideAngleCamera"
                                        onCameraReady={() => {
                                            cameraReadyRef.current = true;
                                            setIsCameraReady(true);
                                        }}
                                    />
                                </View>
                            )}
                            
                            {/* Preview box indicator (always visible when dual mode is on and not capturing) */}
                            {dualModeEnabled && !isCapturingDual && (
                                <View
                                    style={{
                                        position: "absolute",
                                        top: insets.top + 20,
                                        right: 20,
                                        width: Dimensions.get("window").width * 0.3,
                                        aspectRatio: 3 / 4,
                                        borderRadius: 12,
                                        borderWidth: 3,
                                        borderColor: "#fff",
                                        borderStyle: "dashed",
                                        backgroundColor: "rgba(0, 0, 0, 0.3)",
                                        justifyContent: "center",
                                        alignItems: "center",
                                        zIndex: 10,
                                    }}>
                                    <Ionicons
                                        name="camera-outline"
                                        size={32}
                                        color="#fff"
                                        style={{ opacity: 0.6 }}
                                    />
                                </View>
                            )}
                            
                            {/* BeReal-style capture overlay - replaces camera view */}
                            {justCapturedPhoto && isCapturingDual && (
                                <View
                                    style={{
                                        position: "absolute",
                                        top: 0,
                                        left: 0,
                                        right: 0,
                                        bottom: 0,
                                        zIndex: 1000,
                                    }}>
                                    {/* Full-screen captured photo (replaces camera) */}
                                    <Image
                                        source={{ uri: justCapturedPhoto }}
                                        style={{
                                            width: "100%",
                                            height: "100%",
                                        }}
                                        resizeMode="cover"
                                    />
                                    
                                    {/* Dark overlay for dimming */}
                                    <View
                                        style={{
                                            position: "absolute",
                                            top: 0,
                                            left: 0,
                                            right: 0,
                                            bottom: 0,
                                            backgroundColor: "rgba(0, 0, 0, 0.6)",
                                        }}
                                    />
                                    
                                    {/* Live preview camera in top-right corner */}
                                    <View
                                        style={{
                                            position: "absolute",
                                            top: insets.top + 20,
                                            right: 20,
                                            width: Dimensions.get("window").width * 0.3,
                                            aspectRatio: 3 / 4,
                                            borderRadius: 12,
                                            borderWidth: 3,
                                            borderColor: "#fff",
                                            overflow: "hidden",
                                            shadowColor: "#000",
                                            shadowOffset: { width: 0, height: 2 },
                                            shadowOpacity: 0.5,
                                            shadowRadius: 8,
                                            elevation: 10,
                                            zIndex: 1001,
                                        }}>
                                        <CameraView
                                            style={{ width: "100%", height: "100%" }}
                                            facing={facing}
                                            ref={previewCamera}
                                            flash={flash}
                                            zoom={0}
                                            selectedLens="builtInWideAngleCamera"
                                            onCameraReady={() => {
                                                cameraReadyRef.current = true;
                                                setIsCameraReady(true);
                                            }}
                                        />
                                    </View>
                                    
                                    {/* Centered message and countdown */}
                                    <View
                                        style={{
                                            position: "absolute",
                                            top: 0,
                                            left: 0,
                                            right: 0,
                                            bottom: 0,
                                            justifyContent: "center",
                                            alignItems: "center",
                                            paddingHorizontal: 40,
                                            zIndex: 1002,
                                        }}>
                                        {waitingForCamera ? (
                                            <ThemedText
                                                style={{
                                                    fontSize: 24,
                                                    fontWeight: "600",
                                                    color: "#fff",
                                                    textAlign: "center",
                                                }}>
                                                Preparing camera...
                                            </ThemedText>
                                        ) : countdown > 0 ? (
                                            <ThemedText
                                                style={{
                                                    fontSize: 120,
                                                    fontWeight: "900",
                                                    color: "#fff",
                                                    textAlign: "center",
                                                }}>
                                                {countdown}
                                            </ThemedText>
                                        ) : (
                                            <ThemedText
                                                style={{
                                                    fontSize: 36,
                                                    fontWeight: "700",
                                                    color: "#fff",
                                                    textAlign: "center",
                                                }}>
                                                {capturingMessage}
                                            </ThemedText>
                                        )}
                                    </View>
                                </View>
                            )}
                        </>
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
                                    <TouchableOpacity
                                        onPress={() => setDualModeEnabled(!dualModeEnabled)}
                                        style={{
                                            width: 48,
                                            height: 48,
                                            borderRadius: 24,
                                            backgroundColor:
                                                "transparent",
                                            borderWidth: 0,
                                            borderColor: ThemedColor.background === "#000" ? "#fff" : "#000",
                                            justifyContent: "center",
                                            alignItems: "center",
                                        }}>
                                        <Ionicons
                                            name={dualModeEnabled ? "people" : "people-outline"}
                                            size={32}
                                            color={ThemedColor.background === "#000" ? "#fff" : "#000"} 
                                        />
                                    </TouchableOpacity>
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
                                        onPress={skipPhotos}
                                        style={{ flex: photos.length > 0 ? 0 : 1 }}
                                    />
                                </View>
                            </>
                        ) : (
                            <>

                                <View style={{ flexDirection: "column", alignItems: "center", gap: 12, width: "100%" }}>
                                    <PrimaryButton
                                        onPress={() => setViewMode("camera")}
                                        title="Take More Photos"
                                        ghost
                                        colorOverride={ThemedColor.primary}
                                        style={{
                                            width: "100%",
                                        }}
                                    />
                                        <PrimaryButton
                                            onPress={continueWithPhotos}
                                            title={`Done with ${photos.length} photo${photos.length !== 1 ? "s" : ""}`}
                                            style={{
                                                width: "100%",
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
