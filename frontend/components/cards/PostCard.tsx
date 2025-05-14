import React, { useCallback, useRef, useState } from "react";
import { Modal, Image, TouchableOpacity, View, StyleSheet, Dimensions } from "react-native";
import { ThemedText } from "../ThemedText";
import UserInfoRowTimed from "../UserInfo/UserInfoRowTimed";
import ReactPills from "../inputs/ReactPills";
import ReactionAction from "../inputs/ReactionAction";
import Carousel from "react-native-reanimated-carousel";
import Comment, { CommentProps } from "../inputs/Comment";
import { useThemeColor } from "@/hooks/useThemeColor";
import { BottomSheetBackdrop, BottomSheetModal } from "@gorhom/bottom-sheet";
import { HORIZONTAL_PADDING } from "@/constants/layout";
export type SlackReaction = {
    emoji: string;
    count: number;
    ids: string[];
};

type Props = {
    icon: string;
    name: string;
    username: string;
    caption: string;
    time: number;
    priority: string;
    points: number;
    timeTaken: number;
    reactions: SlackReaction[];
    images: string[];
    id?: string;
    comments: CommentProps[];
};

const PostCard = ({
    icon,
    name,
    username,
    caption,
    time,
    priority,
    points,
    timeTaken,
    reactions: initialReactions,
    images,
    comments,
}: Props) => {
    const [modalVisible, setModalVisible] = useState(false);
    const [reactions, setReactions] = useState<SlackReaction[]>(initialReactions);
    const [newReactions, setNewReactions] = useState<SlackReaction[]>([]);
    const allReactions = [...reactions, ...newReactions];
    const [modalIndex, setModalIndex] = useState(0);

    const userId = "67ba5abb616b5e6544e0137b";
    let ThemedColor = useThemeColor();

    const handleClose = () => {
        bottomSheetModalRef.current?.dismiss();
        console.log("handleClose");
    };

    // Then in your component:
    const renderBackdrop = useCallback(
        (props) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />,
        []
    );

    // ref
    const bottomSheetModalRef = useRef<BottomSheetModal>(null);

    // callbacks
    const handleOpenComments = useCallback(() => {
        bottomSheetModalRef.current?.present();
        console.log("handleOpenComments");
    }, []);

    const handleSheetChanges = useCallback((index: number) => {
        console.log("handleSheetChanges", index);
    }, []);

    const handleReaction = ({ emoji, count, ids }: SlackReaction, add: boolean) => {
        setReactions((prevReactions) => {
            const existingReaction = prevReactions?.find((r) => r.emoji === emoji);
            const idsSet = new Set(existingReaction?.ids);

            // checks list of userIds that reacted to see if should add a reaction
            if (idsSet.has(userId) && add) {
                return prevReactions;
            }

            if (existingReaction) {
                return prevReactions
                    .map((r) =>
                        r.emoji === emoji
                            ? {
                                  ...r,
                                  // if add, increase count
                                  // otherwise, subtract 1 if > 1 or make it 0, which filters out
                                  count: add ? r.count + 1 : Math.max(0, r.count - 1),
                                  // add previous ids plus new ids if should add
                                  // otherwise, remove the id that removes reaction
                                  ids: add ? [...r.ids, ...ids] : r.ids.filter((id) => !ids.includes(id)),
                              }
                            : r
                    )
                    .filter((r) => r.count > 0);
            } else if (add) {
                if (!existingReaction) {
                    return [...prevReactions, { emoji, count, ids }];
                }
            }

            return prevReactions;
        });
    };

    const openModal = (imageIndex) => {
        setModalVisible(true);
        setModalIndex(imageIndex);
    };

    const openComments = () => {
        bottomSheetModalRef.current?.present();
    };

    return (
        <View style={styles.container}>
            <View style={{ flexDirection: "column", marginVertical: 16 }}>
                <View style={{ paddingHorizontal: HORIZONTAL_PADDING }}>
                    <UserInfoRowTimed name={name} username={username} time={time} icon={icon} />
                </View>
                <View style={styles.col}>
                    {/* <View style={styles.row}>
                        <ThemedText type="lightBody">❗ {priority}</ThemedText>
                        <ThemedText type="lightBody">💪 {points} pts</ThemedText>
                        <ThemedText type="lightBody">⏰ {timeTaken} hrs</ThemedText>
                    </View> */}
                    <Carousel
                        loop
                        width={Dimensions.get("window").width}
                        style={styles.image}
                        snapEnabled={true}
                        pagingEnabled={true}
                        autoPlayInterval={2000}
                        data={images}
                        renderItem={({ item, index }) => (
                            <TouchableOpacity onLongPress={() => openModal(index)}>
                                <Image source={{ uri: item }} style={styles.image} />
                            </TouchableOpacity>
                        )}
                    />
                </View>
                <View style={{ flexDirection: "column", paddingHorizontal: HORIZONTAL_PADDING }}>
                    <View style={{ marginTop: 12 }}>
                        <ThemedText type="default">{caption}</ThemedText>
                    </View>

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
                            onAddReaction={(emoji) => handleReaction({ emoji: emoji, count: 1, ids: [userId] }, true)}
                            postId={0}
                        />
                    </View>

                    <TouchableOpacity onPress={handleOpenComments}>
                        <ThemedText style={{ paddingTop: 15 }} type="lightBody">
                            💬 Leave a comment
                        </ThemedText>
                    </TouchableOpacity>
                </View>
            </View>
            {modalVisible && (
                <Modal
                    visible={modalVisible}
                    transparent={true}
                    animationType="slide"
                    onRequestClose={() => setModalVisible(false)}>
                    <TouchableOpacity style={styles.modalContainer} onPress={() => setModalVisible(false)}>
                        <View style={styles.modalContent}>
                            <Image source={{ uri: images[modalIndex] }} style={styles.popupImage} />
                            <TouchableOpacity onPress={() => setModalVisible(false)}></TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                </Modal>
            )}

            <BottomSheetModal
                ref={bottomSheetModalRef}
                onChange={handleSheetChanges}
                enableDynamicSizing={true}
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
                enablePanDownToClose={true}
                enableDismissOnClose={true}
                enableHandlePanningGesture={true}
                style={{
                    backgroundColor: ThemedColor.background,
                    borderTopLeftRadius: 24,
                    borderTopRightRadius: 24,
                }}>
                <Comment comments={comments} ref={bottomSheetModalRef} onClose={handleClose} />
            </BottomSheetModal>
        </View>
    );
};

export default PostCard;

const styles = StyleSheet.create({
    image: {
        width: Dimensions.get("window").width * 1,
        height: Dimensions.get("window").width * 1,
    },
    container: {
        flex: 1,
        flexDirection: "column",
        paddingVertical: 4,
        borderBottomWidth: 2,
        borderBottomColor: "rgba(0,0,0,0.2)",
        borderStyle: "solid",
    },
    row: {
        flexDirection: "row",
        gap: 6,
        marginRight: -6,
    },
    col: {
        marginTop: 10,
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 10,
    },
    reactionsRow: {
        marginTop: 18,
        gap: 8,
        flexDirection: "row",
        justifyContent: "flex-start",
        width: Dimensions.get("window").width * 0.87,
        flexWrap: "wrap",
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
