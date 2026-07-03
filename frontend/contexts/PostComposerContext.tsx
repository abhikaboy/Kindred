import React, { createContext, useContext, useMemo, useState, Dispatch, SetStateAction } from "react";
import type { TaggedUser } from "@/components/inputs/TaggedUsersChips";
import type { Song } from "@/api/itunes";

type Ctx = {
    taggedUsers: TaggedUser[];
    setTaggedUsers: Dispatch<SetStateAction<TaggedUser[]>>;
    song: Song | null;
    setSong: Dispatch<SetStateAction<Song | null>>;
};

const PostComposerCtx = createContext<Ctx | null>(null);

export const PostComposerProvider = ({ children }: { children: React.ReactNode }) => {
    const [taggedUsers, setTaggedUsers] = useState<TaggedUser[]>([]);
    const [song, setSong] = useState<Song | null>(null);
    const value = useMemo(() => ({ taggedUsers, setTaggedUsers, song, setSong }), [taggedUsers, song]);
    return (
        <PostComposerCtx.Provider value={value}>
            {children}
        </PostComposerCtx.Provider>
    );
};

export const usePostComposer = () => {
    const ctx = useContext(PostComposerCtx);
    if (!ctx) throw new Error("usePostComposer must be used inside PostComposerProvider");
    return ctx;
};
