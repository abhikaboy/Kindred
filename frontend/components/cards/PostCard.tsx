import React, { useCallback, useRef, useState } from "react";
import {
    Modal,
    Image,
    TouchableOpacity,
    View,
    StyleSheet,
    Dimensions,
    Platform,
    KeyboardAvoidingView,
} from "react-native";
import { ThemedText } from "../ThemedText";
import UserInfoRowTimed from "../UserInfo/UserInfoRowTimed";
import ReactPills from "../inputs/ReactPills";
import ReactionAction from "../inputs/ReactionAction";
import Carousel from "react-native-reanimated-carousel";
import Comment, { CommentProps } from "../inputs/Comment";
import { useThemeColor } from "@/hooks/useThemeColor";
import { BottomSheetBackdrop, BottomSheetModal } from "@gorhom/bottom-sheet";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import Svg, { Path } from "react-native-svg";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import CongratulateModal from "../modals/CongratulateModal";
import { useAuth } from "@/hooks/useAuth";

// SparkleIcon component
const SparkleIcon = ({ size = 24, color = "#ffffff" }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
            d="M18.5232 12.0994L13.6847 10.3181L11.9035 5.47594C11.798 5.18937 11.6072 4.94206 11.3567 4.76736C11.1063 4.59267 10.8082 4.499 10.5029 4.499C10.1975 4.499 9.89949 4.59267 9.64904 4.76736C9.39858 4.94206 9.20773 5.18937 9.10225 5.47594L7.31912 10.3125L2.47694 12.0938C2.19037 12.1992 1.94305 12.3901 1.76836 12.6405C1.59367 12.891 1.5 13.189 1.5 13.4944C1.5 13.7997 1.59367 14.0978 1.76836 14.3482C1.94305 14.5987 2.19037 14.7895 2.47694 14.895L7.31256 16.6875L9.09381 21.5269C9.1993 21.8134 9.39014 22.0608 9.6406 22.2355C9.89106 22.4101 10.1891 22.5038 10.4944 22.5038C10.7998 22.5038 11.0978 22.4101 11.3483 22.2355C11.5987 22.0608 11.7896 21.8134 11.8951 21.5269L13.6763 16.6884L18.5185 14.9072C18.8051 14.8017 19.0524 14.6109 19.2271 14.3604C19.4018 14.1099 19.4954 13.8119 19.4954 13.5066C19.4954 13.2012 19.4018 12.9032 19.2271 12.6527C19.0524 12.4023 18.8051 12.2114 18.5185 12.1059L18.5232 12.0994ZM13.1616 15.2812C12.9589 15.3556 12.7749 15.4732 12.6222 15.6259C12.4696 15.7786 12.352 15.9626 12.2776 16.1653L10.4963 20.9897L8.71881 16.1616C8.64436 15.96 8.52712 15.7769 8.37516 15.6249C8.22319 15.4729 8.04011 15.3557 7.8385 15.2812L3.01412 13.5L7.8385 11.7188C8.04011 11.6443 8.22319 11.5271 8.37516 11.3751C8.52712 11.2231 8.64436 11.04 8.71881 10.8384L10.5001 6.01406L12.2813 10.8384C12.3557 11.0411 12.4733 11.2252 12.626 11.3778C12.7786 11.5305 12.9627 11.6481 13.1654 11.7225L17.9897 13.5037L13.1616 15.2812ZM13.5001 3.75C13.5001 3.55109 13.5791 3.36032 13.7197 3.21967C13.8604 3.07902 14.0511 3 14.2501 3H15.7501V1.5C15.7501 1.30109 15.8291 1.11032 15.9697 0.96967C16.1104 0.829018 16.3011 0.75 16.5001 0.75C16.699 0.75 16.8897 0.829018 17.0304 0.96967C17.171 1.11032 17.2501 1.30109 17.2501 1.5V3H18.7501C18.949 3 19.1397 3.07902 19.2804 3.21967C19.421 3.36032 19.5001 3.55109 19.5001 3.75C19.5001 3.94891 19.421 4.13968 19.2804 4.28033C19.1397 4.42098 18.949 4.5 18.7501 4.5H17.2501V6C17.2501 6.19891 17.171 6.38968 17.0304 6.53033C16.8897 6.67098 16.699 6.75 16.5001 6.75C16.3011 6.75 16.1104 6.67098 15.9697 6.53033C15.8291 6.38968 15.7501 6.19891 15.7501 6V4.5H14.2501C14.0511 4.5 13.8604 4.42098 13.7197 4.28033C13.5791 4.13968 13.5001 3.94891 13.5001 3.75ZM23.2501 8.25C23.2501 8.44891 23.171 8.63968 23.0304 8.78033C22.8897 8.92098 22.699 9 22.5001 9H21.7501V9.75C21.7501 9.94891 21.671 10.1397 21.5304 10.2803C21.3897 10.421 21.199 10.5 21.0001 10.5C20.8011 10.5 20.6104 10.421 20.4697 10.2803C20.3291 10.1397 20.2501 9.94891 20.2501 9.75V9H19.5001C19.3011 9 19.1104 8.92098 18.9697 8.78033C18.8291 8.63968 18.7501 8.44891 18.7501 8.25C18.7501 8.05109 18.8291 7.86032 18.9697 7.71967C19.1104 7.57902 19.3011 7.5 19.5001 7.5H20.2501V6.75C20.2501 6.55109 20.3291 6.36032 20.4697 6.21967C20.6104 6.07902 20.8011 6 21.0001 6C21.199 6 21.3897 6.07902 21.5304 6.21967C21.671 6.36032 21.7501 6.55109 21.7501 6.75V7.5H22.5001C22.699 7.5 22.8897 7.57902 23.0304 7.71967C23.171 7.86032 23.2501 8.05109 23.2501 8.25Z"
            fill={color}
        />
    </Svg>
);

export type SlackReaction = {
    emoji: string;
    count: number;
    ids: string[];
};

type Props = {
    icon: string;
    name: string;
    username: string;
    userId: string;
    caption: string;
    time: number;
    priority?: string;
    points?: number;
    timeTaken?: number;
    reactions?: SlackReaction[];
    images?: string[];
    id?: string;
    comments?: CommentProps[];
    category?: string;
    taskName?: string;
};

const PostCard = ({
    icon,
    name,
    username,
    userId,
    caption,
    time,
    priority,
    points,
    timeTaken,
    reactions,
    images,
    comments,
    category,
    taskName,
    id,
}: Props) => {
    const [modalVisible, setModalVisible] = useState(false);
    const [newReactions, setNewReactions] = useState<SlackReaction[]>([]);
    const allReactions = [...reactions, ...newReactions];
    const [modalIndex, setModalIndex] = useState(0);
    const [congratulateModalVisible, setCongratulateModalVisible] = useState(false);
    const [currentComments, setCurrentComments] = useState(comments || []);

    const ThemedColor = useThemeColor();
    const { user } = useAuth();
    const handleClose = () => {
        bottomSheetModalRef.current?.dismiss();
        console.log("handleClose");
    };

    const renderBackdrop = useCallback(
        (props) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />,
        []
    );

    const bottomSheetModalRef = useRef<BottomSheetModal>(null);

    const handleOpenComments = useCallback(() => {
        bottomSheetModalRef.current?.present();
        console.log("handleOpenComments");
    }, []);

    const handleSheetChanges = useCallback((index: number) => {
        console.log("handleSheetChanges", index);
    }, []);

    const handleCommentAdded = (newComment: any) => {
        console.log("📝 New comment added:", newComment);
        // Add the new comment to current comments
        setCurrentComments((prevComments) => [...(prevComments || []), newComment]);
    };

    const handleReaction = ({ emoji, count, ids }: SlackReaction, add: boolean) => {
        // Add haptic feedback for reactions
        if (Platform.OS === "ios") {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }

        setNewReactions((prevReactions) => {
            const existingReaction = prevReactions?.find((r) => r.emoji === emoji);
            const idsSet = new Set(existingReaction?.ids);

            if (idsSet.has(user?._id || "") && add) {
                return prevReactions;
            }

            if (existingReaction) {
                return prevReactions
                    .map((r) =>
                        r.emoji === emoji
                            ? {
                                  ...r,
                                  count: add ? r.count + 1 : Math.max(0, r.count - 1),
                                  ids: add ? [...r.ids, user?._id || ""] : r.ids.filter((id) => id !== user?._id),
                              }
                            : r
                    )
                    .filter((r) => r.count > 0);
            } else if (add) {
                if (!existingReaction) {
                    return [...prevReactions, { emoji, count: 1, ids: [user?._id || ""] }];
                }
            }

            return prevReactions;
        });
    };

    const openModal = (imageIndex) => {
        setModalVisible(true);
        setModalIndex(imageIndex);
    };

    const formatTime = (timeInHours: number) => {
        if (timeInHours < 1) {
            return `${Math.round(timeInHours * 60)}m ago`;
        } else if (timeInHours < 24) {
            return `${Math.round(timeInHours)}h ago`;
        } else {
            return `${Math.round(timeInHours / 24)}d ago`;
        }
    };

    const handleCongratulatePress = async () => {
        if (!user?._id) {
            // User is not authenticated, could show a login prompt here
            console.log("User not authenticated");
            return;
        }

        if (user._id === userId) {
            // User is trying to congratulate themselves
            console.log("Cannot congratulate yourself");
            return;
        }

        try {
            if (Platform.OS === "ios") {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
        } catch (error) {
            console.log("Haptic error:", error);
        }
        setCongratulateModalVisible(true);
    };

    const styles = stylesheet(ThemedColor);

    return (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
            <View style={[styles.container, { backgroundColor: ThemedColor.background }]}>
                <View style={styles.content}>
                    {/* Header with user info */}
                    <View style={styles.header}>
                        <View style={styles.userInfo}>
                            <TouchableOpacity
                                activeOpacity={0.4}
                                onPress={async () => {
                                    try {
                                        if (Platform.OS === "ios") {
                                            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        }
                                    } catch (error) {
                                        console.log("Haptic error:", error);
                                    }
                                    router.push(`/account/${userId}`);
                                }}>
                                <Image source={{ uri: icon }} style={styles.userIcon} />
                            </TouchableOpacity>
                            <View style={styles.userDetails}>
                                <ThemedText type="default" style={styles.userName}>
                                    {name}
                                </ThemedText>
                                <ThemedText type="caption" style={styles.username}>
                                    {username}
                                </ThemedText>
                            </View>
                        </View>
                        <ThemedText type="caption" style={styles.timeText}>
                            {formatTime(time)}
                        </ThemedText>
                    </View>

                    {/* Image section - only render if images exist */}
                    {images && images.length > 0 && (
                        <View style={styles.imageContainer}>
                            {images.length === 1 ? (
                                <TouchableOpacity onLongPress={() => openModal(0)} activeOpacity={1}>
                                    <Image source={{ uri: images[0] }} style={styles.image} />
                                </TouchableOpacity>
                            ) : (
                                <Carousel
                                    loop
                                    width={Dimensions.get("window").width}
                                    height={Dimensions.get("window").width}
                                    style={styles.carousel}
                                    snapEnabled={true}
                                    pagingEnabled={true}
                                    autoPlayInterval={2000}
                                    data={images}
                                    renderItem={({ item, index }) => (
                                        <TouchableOpacity onLongPress={() => openModal(index)} activeOpacity={1}>
                                            <Image source={{ uri: item }} style={styles.image} />
                                        </TouchableOpacity>
                                    )}
                                />
                            )}
                        </View>
                    )}

                    {/* Category and task section */}
                    {(category || taskName) && (
                        <View style={styles.categorySection}>
                            <View style={styles.categoryRow}>
                                {category && (
                                    <>
                                        <ThemedText style={[styles.categoryText, { color: ThemedColor.primary }]}>
                                            {category}
                                        </ThemedText>
                                        <View style={[styles.dot, { backgroundColor: ThemedColor.primary }]} />
                                    </>
                                )}
                                {taskName && (
                                    <ThemedText style={[styles.categoryText, { color: ThemedColor.text }]}>
                                        {taskName}
                                    </ThemedText>
                                )}
                            </View>
                            <TouchableOpacity
                                style={[
                                    styles.congratulateButton,
                                    (!user?._id || user?._id === userId) && { opacity: 0.5 },
                                ]}
                                onPress={handleCongratulatePress}
                                disabled={!user?._id || user?._id === userId}>
                                <SparkleIcon size={24} color={ThemedColor.text} />
                                <ThemedText style={[styles.congratulateText, { color: ThemedColor.text }]}>
                                    {!user?._id
                                        ? "Login to Congratulate"
                                        : user?._id === userId
                                          ? "Your Post"
                                          : "Congratulate"}
                                </ThemedText>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Caption and reactions */}
                    <View style={styles.captionSection}>
                        <ThemedText type="default" style={[styles.caption, { color: ThemedColor.text }]}>
                            {caption}
                        </ThemedText>

                        <View style={styles.reactionsRow}>
                            {allReactions.map((react, index) => (
                                <ReactPills
                                    key={index}
                                    reaction={react}
                                    postId={0}
                                    onAddReaction={() => handleReaction(react, true)}
                                    onRemoveReaction={() => handleReaction(react, false)}
                                />
                            ))}
                            <ReactionAction
                                onAddReaction={(emoji) =>
                                    handleReaction({ emoji: emoji, count: 1, ids: [user?._id || ""] }, true)
                                }
                                postId={0}
                            />
                        </View>

                        <TouchableOpacity onPress={handleOpenComments} style={styles.commentButton}>
                            <ThemedText style={styles.commentText}>
                                💬{" "}
                                <ThemedText style={[styles.commentText, { color: ThemedColor.caption }]}>
                                    Leave a comment
                                </ThemedText>
                            </ThemedText>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Image modal */}
                {modalVisible && (
                    <Modal
                        visible={modalVisible}
                        transparent={true}
                        animationType="slide"
                        onRequestClose={() => setModalVisible(false)}>
                        <TouchableOpacity
                            activeOpacity={1}
                            style={styles.modalContainer}
                            onPress={() => setModalVisible(false)}>
                            <View style={styles.modalContent}>
                                <Image source={{ uri: images[modalIndex] }} style={styles.popupImage} />
                            </View>
                        </TouchableOpacity>
                    </Modal>
                )}

                {/* Comments bottom sheet */}
                <BottomSheetModal
                    ref={bottomSheetModalRef}
                    onChange={handleSheetChanges}
                    enableDynamicSizing={true}
                    enablePanDownToClose={true}
                    enableDismissOnClose={true}
                    enableHandlePanningGesture={true}
                    keyboardBehavior="interactive"
                    keyboardBlurBehavior="restore"
                    android_keyboardInputMode="adjustResize"
                    handleStyle={{
                        backgroundColor: ThemedColor.background,
                        borderTopLeftRadius: 24,
                        borderTopRightRadius: 24,
                    }}
                    handleIndicatorStyle={{
                        backgroundColor: ThemedColor.text,
                        width: 48,
                        height: 3,
                        borderRadius: 10,
                        marginVertical: 12,
                    }}
                    backgroundStyle={{
                        borderTopLeftRadius: 32,
                        borderTopRightRadius: 32,
                    }}
                    backdropComponent={renderBackdrop}
                    style={{
                        backgroundColor: ThemedColor.background,
                        borderTopLeftRadius: 24,
                        borderTopRightRadius: 24,
                    }}>
                    <Comment
                        comments={currentComments}
                        postId={id}
                        ref={bottomSheetModalRef}
                        onClose={handleClose}
                        onCommentAdded={handleCommentAdded}
                    />
                </BottomSheetModal>

                {/* Congratulate Modal */}
                <CongratulateModal
                    visible={congratulateModalVisible}
                    setVisible={setCongratulateModalVisible}
                    task={{
                        id: "", // We don't have task ID in PostCard props, but it's not required for congratulation
                        content: taskName || caption || "Completed Task",
                        value: points || 0,
                        priority: priority === "high" ? 3 : priority === "medium" ? 2 : 1,
                        categoryId: "",
                    }}
                    congratulationConfig={{
                        userHandle: username,
                        receiverId: userId,
                        categoryName: category || "General",
                    }}
                />
            </View>
        </KeyboardAvoidingView>
    );
};

const stylesheet = (ThemedColor: any) =>
    StyleSheet.create({
        container: {
            flex: 1,
            borderBottomWidth: 1.5,
            borderBottomColor: ThemedColor.tertiary,
            paddingVertical: 8,
        },
        content: {
            paddingVertical: 12,
        },
        header: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: HORIZONTAL_PADDING,
            marginBottom: 18,
        },
        userInfo: {
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            flex: 1,
        },
        userIcon: {
            width: 48,
            height: 48,
            borderRadius: 24,
        },
        userDetails: {
            flex: 1,
            gap: 3,
        },
        userName: {
            fontSize: 16,
            fontWeight: "400",
            color: ThemedColor.text,
        },
        username: {
            fontSize: 14,
            fontWeight: "300",
            color: ThemedColor.caption,
        },
        timeText: {
            fontSize: 12,
            fontWeight: "400",
            color: ThemedColor.caption,
            width: 48,
        },
        imageContainer: {
            width: "100%",
            marginBottom: 18,
        },
        carousel: {
            width: Dimensions.get("window").width,
            height: Dimensions.get("window").width,
        },
        image: {
            width: Dimensions.get("window").width,
            height: Dimensions.get("window").width,
            resizeMode: "cover",
        },
        categorySection: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: HORIZONTAL_PADDING,
            marginBottom: 18,
        },
        categoryRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
        },
        categoryText: {
            fontSize: 16,
            fontWeight: "400",
            letterSpacing: -0.16,
        },
        dot: {
            width: 4,
            height: 4,
            borderRadius: 2,
        },
        congratulateButton: {
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
        },
        congratulateIcon: {
            fontSize: 24,
        },
        congratulateText: {
            fontSize: 14,
            fontWeight: "400",
            letterSpacing: -0.14,
        },
        captionSection: {
            paddingHorizontal: HORIZONTAL_PADDING,
            gap: 16,
        },
        caption: {
            fontSize: 16,
            fontWeight: "400",
            lineHeight: 20,
        },
        reactionsRow: {
            flexDirection: "row",
            gap: 8,
            flexWrap: "wrap",
        },
        commentButton: {
            paddingTop: 4,
        },
        commentText: {
            fontSize: 14,
            fontWeight: "400",
        },
        modalContainer: {
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "rgba(0,0,0,0.5)",
        },
        modalContent: {
            borderRadius: 10,
            alignItems: "center",
        },
        popupImage: {
            width: Dimensions.get("window").width * 0.9,
            height: Dimensions.get("window").width * 0.9,
            resizeMode: "contain",
        },
    });

export default PostCard;
