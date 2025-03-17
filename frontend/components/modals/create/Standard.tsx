import { StyleSheet, Text, TextInput, View } from "react-native";
import React from "react";
import ThemedInput from "../../inputs/ThemedInput";
import Dropdown from "../../inputs/Dropdown";
import { useRequest } from "@/hooks/useRequest";
import { useTasks } from "@/contexts/tasksContext";
import { Screen } from "../CreateModal";

type Props = {
    hide: () => void;
    goTo: (screen: Screen) => void;
};

const Standard = ({ hide, goTo }: Props) => {
    const nameRef = React.useRef<TextInput>(null);
    const { request } = useRequest();
    const { categories, addToCategory } = useTasks();

    const [content, setContent] = React.useState("");
    const [selected, setSelected] = React.useState({ label: "", id: "", special: false });

    const createPost = async () => {
        if (categories.length === 0) return;
        const response = await request("POST", `/user/tasks/${selected.id}`, {
            priority: 1,
            content: content,
            value: 3,
            recurring: false,
            public: true,
            active: false,
        });
        addToCategory(selected.id, response);
    };
    return (
        <View>
            <ThemedInput
                autofocus
                ref={nameRef}
                placeHolder="Enter the Task Name"
                onSubmit={() => {
                    createPost();
                    hide();
                }}
                onChangeText={(text) => {
                    setContent(text);
                }}
                value={content}
                setValue={setContent}
            />
            <Dropdown
                options={[
                    ...categories.map((c) => {
                        return { label: c.name, id: c.id, special: false };
                    }),
                    { label: "+ New Category", id: "", special: true },
                ]}
                selected={selected}
                setSelected={setSelected}
                onSpecial={() => {
                    goTo(Screen.NEW_CATEGORY);
                }}
            />
        </View>
    );
};

export default Standard;

const styles = StyleSheet.create({});
