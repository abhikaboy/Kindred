import React from "react";
import { View } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { WorkspaceSwitcherList } from "@/components/ui/WorkspaceSwitcherList";
import { useTasks } from "@/contexts/tasksContext";
import { Screen } from "../CreateModal";

type Props = {
    goTo: (screen: Screen) => void;
};

// Copy-flow first step: pick which workspace the tagged task lands in before
// the Standard create sheet (which is scoped to the selected workspace).
const SelectWorkspace = ({ goTo }: Props) => {
    const { workspaces, selected, setSelected } = useTasks();
    const realWorkspaces = workspaces.filter((ws) => !ws.isBlueprint);

    const handleSelect = (name: string) => {
        setSelected(name);
        goTo(Screen.STANDARD);
    };

    return (
        <View style={{ gap: 12 }}>
            <ThemedText type="subtitle">Copy to which workspace?</ThemedText>
            {realWorkspaces.length === 0 ? (
                <ThemedText type="caption">Create a workspace first to copy this task into it.</ThemedText>
            ) : (
                <WorkspaceSwitcherList
                    workspaces={realWorkspaces}
                    selected={selected}
                    onSelectWorkspace={handleSelect}
                />
            )}
        </View>
    );
};

export default SelectWorkspace;
