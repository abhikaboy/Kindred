import { render, fireEvent } from "@testing-library/react-native";
import TagChip from "@/components/TagChip";

describe("TagChip", () => {
    test("renders the tag label", () => {
        const { getByText } = render(<TagChip tag="fitness" />);
        getByText("fitness");
    });

    test("calls onPress with the tag when pressed", () => {
        const onPress = jest.fn();
        const { getByText } = render(<TagChip tag="work" onPress={onPress} />);
        fireEvent.press(getByText("work"));
        expect(onPress).toHaveBeenCalledWith("work");
    });
});
