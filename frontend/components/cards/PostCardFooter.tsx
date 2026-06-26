import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { ThemedText } from "../ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import { Confetti } from "phosphor-react-native";
import ReactPills from "../inputs/ReactPills";
import ReactionAction from "../inputs/ReactionAction";
import KudosAvatars from "./KudosAvatars";
import type { SlackReaction } from "./PostCard";
import type { TaggedUser } from "./types";
import type { PostKudos } from "@/api/types";
import PostCardCaption from "./PostCardCaption";

export type PostCardFooterProps = {
    caption?: string;
    taggedUsers?: TaggedUser[];
    category?: string;
    taskName?: string;
    reactions?: SlackReaction[];
    kudos?: PostKudos[];
    /** Read-only mode: disables all interactions (used in preview) */
    readOnly?: boolean;
    // Interactive-mode props (ignored when readOnly)
    userId?: string;
    currentUserId?: string;
    onReaction?: (emoji: string) => void;
    hasUserReacted?: (emoji: string) => boolean;
    onCongratulatePress?: () => void;
    onOpenComments?: () => void;
    onKudosPress?: () => void;
    commentCount?: number;
    onLongPressReaction?: (reaction: SlackReaction) => void;
};

const PostCardFooter = ({
    caption,
    taggedUsers = [],
    category,
    taskName,
    reactions = [],
    kudos = [],
    readOnly = false,
    userId,
    currentUserId,
    onReaction,
    hasUserReacted,
    onCongratulatePress,
    onOpenComments,
    onKudosPress,
    commentCount = 0,
    onLongPressReaction,
}: PostCardFooterProps) => {
    const ThemedColor = useThemeColor();

    const isOwnPost = currentUserId && userId && currentUserId === userId;
    const congratulateDisabled = readOnly || !currentUserId || isOwnPost;

    return (
        <View>
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
                        style={[styles.congratulateButton, congratulateDisabled && { opacity: 0.5 }]}
                        onPress={onCongratulatePress}
                        disabled={congratulateDisabled}
                    >
                        <Confetti size={24} weight="regular" color={ThemedColor.primary} />
                        <ThemedText style={[styles.congratulateText, { color: ThemedColor.primary }]}>
                            {isOwnPost && currentUserId && !readOnly ? "Your Post" : "Send Kudos"}
                        </ThemedText>
                    </TouchableOpacity>
                </View>
            )}

            <View style={styles.captionSection}>
                {caption ? (
                    <PostCardCaption caption={caption} taggedUsers={taggedUsers} />
                ) : null}

                {!readOnly && (
                    <View style={styles.reactionsRow}>
                        {kudos.length > 0 && (
                            <TouchableOpacity onPress={onKudosPress} activeOpacity={0.7} style={styles.kudosCluster}>
                                <KudosAvatars
                                    kudos={kudos}
                                    ringColor={ThemedColor.background}
                                    placeholderColor={ThemedColor.primary}
                                    glowColor={ThemedColor.primary}
                                />
                            </TouchableOpacity>
                        )}
                        {reactions.map((react, index) => (
                            <ReactPills
                                key={`${react.emoji}-${index}`}
                                reaction={react}
                                postId={0}
                                isHighlighted={hasUserReacted?.(react.emoji) ?? false}
                                onPress={() => onReaction?.(react.emoji)}
                                onLongPress={() => onLongPressReaction?.(react)}
                            />
                        ))}
                        <ReactionAction onAddReaction={(emoji) => onReaction?.(emoji)} postId={0} />
                    </View>
                )}

                <TouchableOpacity
                    onPress={readOnly ? undefined : onOpenComments}
                    style={styles.commentButton}
                    disabled={readOnly}
                >
                    <ThemedText style={styles.commentText}>
                        💬{" "}
                        <ThemedText style={[styles.commentText, { color: ThemedColor.caption }]}>
                            {commentCount === 0 ? "Leave a comment" : `View ${commentCount} comment${commentCount === 1 ? "" : "s"}`}{" "}
                        </ThemedText>
                    </ThemedText>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        opacity: 0.8,
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
        flexWrap: "wrap",
        maxWidth: "70%",
        flex: 1,
    },
    categoryText: {
        fontSize: 16,
        fontWeight: "400",
        letterSpacing: -0.16,
    },
    congratulateButton: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
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
        alignItems: "center",
    },
    kudosCluster: {
        justifyContent: "center",
        marginRight: 2,
    },
    commentButton: {
        paddingTop: 4,
    },
    commentText: {
        fontSize: 14,
        fontWeight: "400",
    },
});

export default PostCardFooter;
