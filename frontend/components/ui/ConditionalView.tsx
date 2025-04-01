import { StyleSheet, Text, View } from "react-native";
import React from "react";

type Props = {
    children: React.ReactNode;
    condition: boolean;
};

const ConditionalView = ({ condition, children }: Props) => {
    if (condition) return children;
    return null;
};

export default ConditionalView;
