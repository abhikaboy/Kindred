import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { ThemedText } from "../ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import { Confetti } from "phosphor-react-native";
import ReactPills from "../inputs/ReactPills";
import ReactionAction from "../inputs/ReactionAction";
import type { SlackReaction } from "./PostCard";

export type PostCardFooterProps = {
    caption?: string;
    category?: string;
    taskName?: string;
    reactions?: SlackReaction[];
    /** Read-only mode: disables all interactions (used in preview) */
    readOnly?: boolean;
    // Interactive-mode props (ignored when readOnly)
    userId?: string;
    currentUserId?: string;
    onReaction?: (emoji: string) => void;
    hasUserReacted?: (emoji: string) => boolean;
    onCongratulatePress?: () => void;
    onOpenComments?: () => void;
    commentCount?: number;
};

const PostCardFooter = ({
    caption,
    category,
    taskName,
    reactions = [],
    readOnly = false,
    userId,
    currentUserId,
    onReaction,
    hasUserReacted,
    onCongratulatePress,
    onOpenComments,
    commentCount = 0,
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
                            {readOnly
                                ? "Congratulate"
                                : !currentUserId
                                  ? "Congratulate"
                                  : isOwnPost
                                    ? "Your Post"
                                    : "Congratulate"}
                        </ThemedText>
                    </TouchableOpacity>
                </View>
            )}

            <View style={styles.captionSection}>
                {caption ? (
                    <ThemedText type="default" style={[styles.caption, { color: ThemedColor.text }]}>
                        {caption}
                    </ThemedText>
                ) : null}

                <View style={styles.reactionsRow}>
                    {readOnly ? (
                        reactions.map((react, index) => (
                            <View
                                key={`${react.emoji}-${index}`}
                                style={[styles.reactionPill, { backgroundColor: ThemedColor.lightened }]}
                            >
                                <ThemedText style={styles.reactionPillText}>
                                    {react.emoji} {react.count}
                                </ThemedText>
                            </View>
                        ))
                    ) : (
                        <>
                            {reactions.map((react, index) => (
                                <ReactPills
                                    key={`${react.emoji}-${index}`}
                                    reaction={react}
                                    postId={0}
                                    isHighlighted={hasUserReacted?.(react.emoji) ?? false}
                                    onPress={() => onReaction?.(react.emoji)}
                                />
                            ))}
                            <ReactionAction onAddReaction={(emoji) => onReaction?.(emoji)} postId={0} />
                        </>
                    )}
                </View>

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
    },
    reactionPill: {
        borderRadius: 20,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    reactionPillText: {
        fontSize: 14,
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
