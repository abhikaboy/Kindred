import React from "react";
import { View, TouchableOpacity } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import Feather from "@expo/vector-icons/Feather";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useTaskCreation } from "@/contexts/taskCreationContext";
import FriendPicker from "@/components/inputs/FriendPicker";
import TaggedUsersChips from "@/components/inputs/TaggedUsersChips";
import type { MentionCandidate } from "@/hooks/useFriendsForMention";

type Props = {
    goToStandard: () => void;
};

const Collaborators = ({ goToStandard }: Props) => {
    const ThemedColor = useThemeColor();
    const { taggedUsers, setTaggedUsers } = useTaskCreation();

    const toggle = (c: MentionCandidate) => {
        if (taggedUsers.some((u) => u.id === c.id)) {
            setTaggedUsers(taggedUsers.filter((u) => u.id !== c.id));
        } else {
            setTaggedUsers([...taggedUsers, { id: c.id, handle: c.handle, display_name: c.display_name }]);
        }
    };

    return (
        <View style={{ gap: 16, flex: 1 }}>
            <View style={{ flexDirection: "row", gap: 16, alignItems: "center" }}>
                <TouchableOpacity onPress={goToStandard}>
                    <Feather name="arrow-left" size={24} color={ThemedColor.text} />
                </TouchableOpacity>
                <ThemedText type="defaultSemiBold">Tag friends</ThemedText>
            </View>
            <TaggedUsersChips
                users={taggedUsers}
                onRemove={(id) => setTaggedUsers(taggedUsers.filter((u) => u.id !== id))}
            />
            {/* Fixed height prevents nested VirtualizedList warning inside BottomSheetScrollView */}
            <View style={{ height: 400 }}>
                <FriendPicker
                    selectedIds={new Set(taggedUsers.map((u) => u.id))}
                    onToggle={toggle}
                />
            </View>
        </View>
    );
};

export default Collaborators;
