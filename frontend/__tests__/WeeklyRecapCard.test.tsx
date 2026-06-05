import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { router } from "expo-router";

jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));

import WeeklyRecapCard from "@/components/forYou/WeeklyRecapCard";

const card = {
    id: "recap-1",
    type: "weekly_recap" as const,
    displayMode: "full" as const,
    iconKind: "recap" as const,
    title: "This week at a glance",
    metrics: [
        { label: "Kudos received", value: 5 },
        { label: "Kudos sent", value: 2 },
        { label: "Comments", value: 0 },
        { label: "Rings closed", value: 4 },
    ],
    ctas: [],
    deepLink: "/(logged-in)/(tabs)/(feed)/Notifications",
    priority: 10,
};

describe("WeeklyRecapCard", () => {
    beforeEach(() => (router.push as jest.Mock).mockClear());

    test("renders the title and every metric row, including zero values", () => {
        const { getByText } = render(<WeeklyRecapCard card={card} />);
        getByText("This week at a glance");
        getByText("Kudos received");
        getByText("5");
        getByText("Kudos sent");
        getByText("2");
        getByText("Comments");
        getByText("0");
        getByText("Rings closed");
        getByText("4");
    });

    test("navigates to the deep link when tapped", () => {
        const { getByText } = render(<WeeklyRecapCard card={card} />);
        fireEvent.press(getByText("This week at a glance"));
        expect(router.push).toHaveBeenCalledWith("/(logged-in)/(tabs)/(feed)/Notifications");
    });
});
