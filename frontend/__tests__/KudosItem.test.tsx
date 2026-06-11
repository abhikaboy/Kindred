import React from "react";
import { render } from "@testing-library/react-native";
import KudosItem from "@/components/cards/KudosItem";

jest.mock("@/components/CachedImage", () => "CachedImage");
jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }) }));
// Reanimated v4 pulls in react-native-worklets at import time, which crashes under jest
jest.mock("react-native-worklets", () => require("react-native-worklets/src/mock"));
jest.mock("react-native-reanimated", () => require("react-native-reanimated/mock"));

const base = {
    id: "k1",
    sender: { name: "Sarah", picture: "https://x/a.png", id: "u1" },
    message: "you crushed it",
    timestamp: new Date().toISOString(),
    read: true,
    type: "message",
};

describe("KudosItem", () => {
    test("task-scope kudos shows category, task and message", () => {
        const { getByText } = render(
            <KudosItem
                kudos={{ ...base, scope: "task", categoryName: "Fitness", taskName: "Morning run" }}
                formatTime={() => "5m ago"}
            />,
        );
        getByText("Fitness");
        getByText("Morning run");
        getByText("you crushed it");
        getByText("5m ago");
    });

    test("profile-scope kudos shows the profile header", () => {
        const { getByText } = render(
            <KudosItem kudos={{ ...base, scope: "profile" }} formatTime={() => "now"} />,
        );
        getByText("Profile Encouragement 🎉");
    });
});
