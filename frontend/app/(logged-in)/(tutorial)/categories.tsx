import { Dimensions, StyleSheet, View, Animated, TouchableOpacity, ScrollView } from "react-native";
import React, { useEffect, useRef, useState } from "react";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useRouter } from "expo-router";
import { useThemeColor } from "@/hooks/useThemeColor";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import { OnboardingBackground } from "@/components/onboarding/BackgroundGraphics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import AntDesign from "@expo/vector-icons/AntDesign";
import CreateModal from "@/components/modals/CreateModal";

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

type Props = {};

const CategoriesTutorialScreen = (props: Props) => {
    const ThemedColor = useThemeColor();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [videoLoopCount, setVideoLoopCount] = useState(0);
    const [showCategory, setShowCategory] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [currentHint, setCurrentHint] = useState<'swipe' | 'tap'>('swipe');
    const videoRef = useRef<Video>(null);
    const scrollViewRef = useRef<ScrollView>(null);

    // Animation values
    const fadeAnimation = useRef(new Animated.Value(0)).current;
    const slideAnimation = useRef(new Animated.Value(30)).current;
    const categoryOpacity = useRef(new Animated.Value(0)).current;
    const hintOpacity = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        // Fade in animation on mount
        Animated.parallel([
            Animated.timing(fadeAnimation, {
                toValue: 1,
                duration: 640,
                delay: 160,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnimation, {
                toValue: 0,
                duration: 640,
                delay: 160,
                useNativeDriver: true,
            }),
        ]).start();

        // Show category after 3 seconds
        setTimeout(() => {
            setShowCategory(true);
            Animated.timing(categoryOpacity, {
                toValue: 1,
                duration: 500,
                useNativeDriver: true,
            }).start();
        }, 3000);
    }, []);

    const handleVideoStatusUpdate = (status: AVPlaybackStatus) => {
        if (status.isLoaded && status.didJustFinish) {
            const newCount = videoLoopCount + 1;
            setVideoLoopCount(newCount);
            
            // After 2 loops (and category is visible), auto-scroll to category and change hint
            if (newCount >= 2 && showCategory) {
                scrollViewRef.current?.scrollTo({ 
                    x: screenWidth - HORIZONTAL_PADDING * 2 + 16, 
                    animated: true 
                });
                
                // Change hint to tap after scrolling
                setTimeout(() => {
                    Animated.timing(hintOpacity, {
                        toValue: 0,
                        duration: 300,
                        useNativeDriver: true,
                    }).start(() => {
                        setCurrentHint('tap');
                        Animated.timing(hintOpacity, {
                            toValue: 1,
                            duration: 300,
                            useNativeDriver: true,
                        }).start();
                    });
                }, 500); // Wait for scroll animation
            }
        }
    };

    const handleScroll = (event: any) => {
        const offsetX = event.nativeEvent.contentOffset.x;
        const pageWidth = screenWidth - HORIZONTAL_PADDING * 2 + 16; // width + gap
        
        // If scrolled past halfway to second page, show tap hint
        if (offsetX > pageWidth / 2 && currentHint === 'swipe') {
            Animated.timing(hintOpacity, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }).start(() => {
                setCurrentHint('tap');
                Animated.timing(hintOpacity, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }).start();
            });
        }
    };

    const handleCategoryPress = () => {
        // Show modal
        setShowModal(true);
    };

    const handleModalOpen = () => {
        // When modal is opened, navigate after delay
        setTimeout(() => {
            setShowModal(false);
            setTimeout(() => {
                router.push('/(logged-in)/(tutorial)/task-details');
            }, 300);
        }, 2000);
    };

    useEffect(() => {
        if (showModal) {
            handleModalOpen();
        }
    }, [showModal]);

    return (
        <ThemedView style={styles.container}>
            {/* Background Graphics */}
            <OnboardingBackground />

            <Animated.View 
                style={[
                    styles.content,
                    {
                        opacity: fadeAnimation,
                        transform: [{ translateY: slideAnimation }],
                        paddingTop: insets.top + 20,
                        paddingBottom: insets.bottom + 20,
                    }
                ]}
            >
                {/* Hint Text */}
                <Animated.View style={[styles.hintContainer, { opacity: hintOpacity }]}>
                    <ThemedText type="default" style={[styles.hintText, { color: ThemedColor.caption }]}>
                        {currentHint === 'swipe' 
                            ? 'Swipe to create →' 
                            : 'Tap on a category to create a task'}
                    </ThemedText>
                </Animated.View>

                {/* Carousel Container */}
                <ScrollView 
                    ref={scrollViewRef}
                    horizontal 
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    scrollEnabled={showCategory}
                    style={styles.carouselContainer}
                    contentContainerStyle={styles.carouselContent}
                    onScroll={handleScroll}
                    scrollEventThrottle={16}
                >
                    {/* Video */}
                    <View style={styles.videoContainer}>
                        <Video
                            ref={videoRef}
                            source={require('@/assets/video/create-task.mp4')}
                            style={styles.video}
                            resizeMode={ResizeMode.COVER}
                            shouldPlay
                            isLooping
                            isMuted
                            onPlaybackStatusUpdate={handleVideoStatusUpdate}
                        />
                    </View>

                    {/* Interactive Categories */}
                    {showCategory && (
                        <Animated.View style={[styles.categoryContainer, { opacity: categoryOpacity, backgroundColor: ThemedColor.background }]}>
                            {/* Workspace Name */}
                            <ThemedText type="title" style={styles.workspaceName}>
                                Workspace
                            </ThemedText>

                            {/* Category 1 - To Do */}
                            <View style={styles.categoryItem}>
                                <TouchableOpacity
                                    style={styles.categoryHeader}
                                    onPress={handleCategoryPress}
                                >
                                    <ThemedText type="subtitle">📝 To Do</ThemedText>
                                    <AntDesign name="plus" size={16} color={ThemedColor.caption} />
                                </TouchableOpacity>
                            </View>

                            {/* Category 2 - In Progress */}
                            <View style={styles.categoryItem}>
                                <TouchableOpacity
                                    style={styles.categoryHeader}
                                    onPress={handleCategoryPress}
                                >
                                    <ThemedText type="subtitle">⚡ In Progress</ThemedText>
                                    <AntDesign name="plus" size={16} color={ThemedColor.caption} />
                                </TouchableOpacity>
                            </View>

                            {/* Category 3 - Ideas */}
                            <View style={styles.categoryItem}>
                                <TouchableOpacity
                                    style={styles.categoryHeader}
                                    onPress={handleCategoryPress}
                                >
                                    <ThemedText type="subtitle">💡 Ideas</ThemedText>
                                    <AntDesign name="plus" size={16} color={ThemedColor.caption} />
                                </TouchableOpacity>
                            </View>
                        </Animated.View>
                    )}
                </ScrollView>

                {/* Title */}
                <View style={styles.titleContainer}>
                    <ThemedText type="titleFraunces" style={styles.title}>
                        Click on a category to make a task
                    </ThemedText>
                </View>

                {/* Spacer to push title to bottom */}
                <View style={styles.spacer} />
            </Animated.View>

            {/* Create Modal */}
            <CreateModal
                visible={showModal}
                setVisible={setShowModal}
                categoryId="tutorial-category"
            />
        </ThemedView>
    );
};

export default CategoriesTutorialScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        position: 'relative',
    },
    content: {
        flex: 1,
        paddingHorizontal: HORIZONTAL_PADDING,
        position: 'relative',
        zIndex: 1,
    },
    hintContainer: {
        marginBottom: 16,
        alignItems: 'center',
    },
    hintText: {
        fontSize: 16,
        textAlign: 'center',
        fontFamily: 'Outfit',
    },
    carouselContainer: {
        flexGrow: 0,
        marginBottom: 16,
    },
    carouselContent: {
        gap: 16,
    },
    videoContainer: {
        width: 250,
        height: 542,
        borderRadius: 12,
        overflow: 'hidden',
    },
    video: {
        width: '100%',
        height: '100%',
    },
    categoryContainer: {
        width: screenWidth - HORIZONTAL_PADDING * 2,
        height: 542,
        justifyContent: 'flex-start',
        paddingTop: 20,
        gap: 16,
        borderRadius: 12,
        paddingHorizontal: HORIZONTAL_PADDING,
    },
    workspaceName: {
        marginBottom: 8,
        fontWeight: '600',
    },
    categoryItem: {
        gap: 16,
        marginBottom: 4,
    },
    categoryHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
    },
    titleContainer: {
        marginTop: 16,
        marginBottom: 32,
        paddingRight: 24,
    },
    title: {
        fontSize: 32,
        letterSpacing: -1,
        lineHeight: 38,
    },
    spacer: {
        flex: 1,
    },
});

