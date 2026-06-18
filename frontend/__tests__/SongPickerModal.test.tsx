import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import SongPickerModal from "@/components/profile/song/SongPickerModal";
import { searchSongs } from "@/api/itunes";

// One shared mock player so we can assert source swaps and playback control.
const mockPlayer = {
    loop: false,
    play: jest.fn(),
    pause: jest.fn(),
    replaceAsync: jest.fn().mockResolvedValue(undefined),
};
jest.mock("expo-video", () => ({
    useVideoPlayer: (_source: unknown, setup?: (p: unknown) => void) => {
        setup?.(mockPlayer);
        return mockPlayer;
    },
    VideoView: "VideoView",
}));

jest.mock("expo-image", () => ({ Image: "Image" }));
jest.mock("react-native-worklets", () => require("react-native-worklets/src/mock"));
jest.mock("react-native-reanimated", () => require("react-native-reanimated/mock"));

jest.mock("@/api/itunes", () => ({ searchSongs: jest.fn() }));

const songA = {
    id: 1,
    title: "Song A",
    artist: "Artist A",
    previewUrl: "https://x/a.m4a",
    artworkUrl: "https://x/a.jpg",
};
const songB = {
    id: 2,
    title: "Song B",
    artist: "Artist B",
    previewUrl: "https://x/b.m4a",
    artworkUrl: "https://x/b.jpg",
};

beforeEach(() => {
    jest.clearAllMocks();
    (searchSongs as jest.Mock).mockResolvedValue([songA, songB]);
});

async function renderWithResults() {
    const onSelect = jest.fn();
    const onClose = jest.fn();
    const view = render(<SongPickerModal visible onClose={onClose} onSelect={onSelect} />);
    fireEvent.changeText(view.getByPlaceholderText("Search songs or artists"), "song");
    await waitFor(() => view.getByText("Song A"));
    return { ...view, onSelect, onClose };
}

describe("SongPickerModal", () => {
    test("tapping a row previews its clip; tapping it again stops", async () => {
        const { getByText } = await renderWithResults();
        mockPlayer.pause.mockClear(); // the debounced search pauses on every keystroke

        fireEvent.press(getByText("Song A"));
        expect(mockPlayer.replaceAsync).toHaveBeenCalledWith(songA.previewUrl);
        await waitFor(() => expect(mockPlayer.play).toHaveBeenCalled());
        expect(mockPlayer.pause).not.toHaveBeenCalled();

        fireEvent.press(getByText("Song A"));
        expect(mockPlayer.pause).toHaveBeenCalledTimes(1);
    });

    test("tapping a different row swaps the source", async () => {
        const { getByText } = await renderWithResults();

        fireEvent.press(getByText("Song A"));
        fireEvent.press(getByText("Song B"));
        expect(mockPlayer.replaceAsync).toHaveBeenLastCalledWith(songB.previewUrl);
    });

    test("the + button selects and closes; a row tap does not select", async () => {
        const { getByText, getByLabelText, onSelect, onClose } = await renderWithResults();

        fireEvent.press(getByText("Song A"));
        expect(onSelect).not.toHaveBeenCalled();

        fireEvent.press(getByLabelText("Use Song A"));
        expect(onSelect).toHaveBeenCalledWith(songA);
        expect(onClose).toHaveBeenCalled();
    });
});
