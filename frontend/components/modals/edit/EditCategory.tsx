import { StyleSheet, Text, View } from "react-native";
import React from "react";
import BottomMenuModal from "../BottomMenuModal";
import { deleteCategory } from "@/api/category";

type Props = {
    editing: boolean;
    setEditing: (editing: boolean) => void;
    id: string;
};

const EditCategory = (props: Props) => {
    const { editing, setEditing, id } = props;
    const options = [
        { label: "Edit", icon: "edit", callback: () => {} },
        {
            label: "Delete",
            icon: "delete",
            callback: () => {
                console.log("deleting category", id);
                deleteCategory(id);
                setEditing(false);
            },
        },
    ];
    return (
        <BottomMenuModal id={{ id: "", category: id }} visible={editing} setVisible={setEditing} options={options} />
    );
};

export default EditCategory;

const styles = StyleSheet.create({});
