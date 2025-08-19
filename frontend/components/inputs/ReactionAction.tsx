import React, { useState } from "react";
import { View, TouchableOpacity, Text, StyleSheet, useColorScheme } from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";
import EmojiPicker from "rn-emoji-keyboard";

type ReactionActionProps = {
  postId: number;
  onAddReaction: (emoji: string) => void;
};

const ReactionAction = ({ onAddReaction }: ReactionActionProps) => {
  const [showEmojiSelector, setShowEmojiSelector] = useState(false);
  const ThemedColor = useThemeColor();
  const colorScheme = useColorScheme();
  const styles = stylesheet(ThemedColor);

  const handleEmojiSelected = (emoji: { emoji: string }) => {
    console.log("✅ Emoji selected:", emoji.emoji);
    onAddReaction(emoji.emoji);
    setShowEmojiSelector(false);
  };

  const getEmojiPickerTheme = () => {
    const isDark = colorScheme === 'dark';
    
    return {
      backdrop: isDark ? "#13121F88" : "#FFFFFF88", 
      knob: ThemedColor.text, 
      container: ThemedColor.background, 
      header: ThemedColor.text, 
      skinTonesContainer: ThemedColor.lightened, 
      category: {
        icon: ThemedColor.caption, 
        iconActive: ThemedColor.primary, 
        container: ThemedColor.lightened, 
        containerActive: ThemedColor.tertiary,
      },
      search: {
        text: ThemedColor.text, 
        placeholder: ThemedColor.caption, 
        icon: ThemedColor.caption, 
        background: ThemedColor.input, 
      },
    };
  };

  return (
    <View>
      <TouchableOpacity
        onPress={() => setShowEmojiSelector(true)}
        style={styles.reactionButton}
      >
        <Text style={styles.reactionButtonText}>+</Text>
      </TouchableOpacity>

      <EmojiPicker
        open={showEmojiSelector}
        onClose={() => setShowEmojiSelector(false)}
        onEmojiSelected={handleEmojiSelected}
        expandable={true} 
        enableRecentlyUsed={true} 
        enableSearchBar={true} 
        theme={getEmojiPickerTheme()} 
      />
    </View>
  );
};

const stylesheet = (ThemedColor: any) =>
  StyleSheet.create({
    reactionButton: {
      flexDirection: "row",
      backgroundColor: "#3f1d4c",
      borderStyle: "solid",
      borderColor: "#3f1d4c",
      borderWidth: 1.4,
      borderRadius: 23,
      paddingHorizontal: 9,
      paddingVertical: 4,
      alignSelf: "flex-start",
      alignItems: "center",
      justifyContent: "center",
      minWidth: 31,
      minHeight: 29,
    },
    reactionButtonText: {
      color: ThemedColor.buttonText,
      fontSize: 20,
      fontWeight: "300",
    },
  });

export default ReactionAction;