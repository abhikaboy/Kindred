import React, { useRef, useState } from "react";
import { View, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import ThemedInput from "@/components/inputs/ThemedInput";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { useThemeColor } from "@/hooks/useThemeColor";
import Feather from "@expo/vector-icons/Feather";
import { useTasks } from "@/contexts/tasksContext";
import { showToastable } from "react-native-toastable";
import DefaultToast from "@/components/ui/DefaultToast";
import { updateCategory } from "@/api/category";
import TagEditor, { type TagEditorHandle } from "@/components/TagEditor";

type Props = {
    hide: () => void;
    categoryId: string;
    currentName: string;
    currentTags?: string[];
};

const EditCategoryModal = ({ hide, categoryId, currentName, currentTags }: Props) => {
    let ThemedColor = useThemeColor();
    const [name, setName] = useState(currentName);
    const { renameCategory, updateCategoryTags } = useTasks();

    const [tags, setTags] = useState<string[]>(currentTags ?? []);
    const tagEditorRef = useRef<TagEditorHandle>(null);

    const handleEditCategory = async () => {
        if (name.length == 0) {
            Alert.alert("Invalid Category Name", "Category name cannot be empty");
            return;
        }

        // Flush any tag still sitting in the input so it isn't silently dropped
        // when the user taps the primary CTA instead of "Add".
        const effectiveTags = tagEditorRef.current?.flush() ?? tags;

        const nameChanged = name !== currentName && name.length > 0;
        const tagsChanged = JSON.stringify(effectiveTags) !== JSON.stringify(currentTags ?? []);

        if (!nameChanged && !tagsChanged) {
            // No change, just close the modal
            hide();
            return;
        }

        try {
            if (nameChanged) {
                await renameCategory(categoryId, name);
            }
            if (tagsChanged) {
                await updateCategory(categoryId, { tags: effectiveTags } as any);
                updateCategoryTags(categoryId, effectiveTags);
            }

            // Show success toast
            showToastable({
                title: "Category updated!",
                status: "success",
                position: "top",
                swipeDirection: "up",
                duration: 2500,
                message: nameChanged
                    ? `Category renamed from "${currentName}" to "${name}"`
                    : "Category tags updated",
                renderContent: (props) => <DefaultToast {...props} />,
            });

            hide();
        } catch (err) {
            console.log(err);

            // Show error toast
            showToastable({
                title: "Error",
                status: "danger",
                position: "top",
                message: "Failed to update category. Please try again.",
                renderContent: (props) => <DefaultToast {...props} />,
            });

            setName(currentName); // Reset to original name on error
            setTags(currentTags ?? []);
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: ThemedColor.background }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={hide}>
                    <Feather name="arrow-left" size={24} color={ThemedColor.text} />
                </TouchableOpacity>
                <ThemedText type="subtitle" style={styles.title}>
                    Edit Category
                </ThemedText>
            </View>
            <View style={{ gap: 16 }}>
                <ThemedInput
                    autofocus
                    useBottomSheetInput={true}
                    placeHolder="Enter the Category Name"
                    onSubmit={() => {
                        handleEditCategory();
                    }}
                    onChangeText={(text) => {
                        setName(text);
                    }}
                    value={name}
                    setValue={setName}
                />
                <TagEditor ref={tagEditorRef} tags={tags} onChange={setTags} />
                <View style={styles.buttonContainer}>
                    <PrimaryButton
                        title="Update Category"
                        onPress={() => {
                            handleEditCategory();
                        }}
                    />
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        gap: 24,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    title: {
        flex: 1,
        textAlign: "center",
        marginRight: 36, // Offset the arrow width for true centering
    },
    buttonContainer: {
        marginTop: 8,
    },
});

export default EditCategoryModal;
