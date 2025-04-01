import { StyleSheet, Text, View } from "react-native";
import React from "react";
import BottomMenuModal from "../BottomMenuModal";

type Props = {
    editing: boolean;
    setEditing: (editing: boolean) => void;
    id: string;
};

const EditWorkspace = (props: Props) => {
    const { editing, setEditing, id } = props;
    const options = [
        { label: "Edit", icon: "edit", callback: () => {} },
        { label: "Delete", icon: "delete", callback: () => {} },
    ];
    return (
        <BottomMenuModal id={{ id: "", category: id }} visible={editing} setVisible={setEditing} options={options} />
    );
};

export default EditWorkspace;

const styles = StyleSheet.create({});
