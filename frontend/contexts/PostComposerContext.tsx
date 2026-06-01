import React, { createContext, useContext, useState, Dispatch, SetStateAction } from "react";
import type { TaggedUser } from "@/components/inputs/TaggedUsersChips";

type Ctx = {
    taggedUsers: TaggedUser[];
    setTaggedUsers: Dispatch<SetStateAction<TaggedUser[]>>;
};

const PostComposerCtx = createContext<Ctx | null>(null);

export const PostComposerProvider = ({ children }: { children: React.ReactNode }) => {
    const [taggedUsers, setTaggedUsers] = useState<TaggedUser[]>([]);
    return <PostComposerCtx.Provider value={{ taggedUsers, setTaggedUsers }}>{children}</PostComposerCtx.Provider>;
};

export const usePostComposer = () => {
    const ctx = useContext(PostComposerCtx);
    if (!ctx) throw new Error("usePostComposer must be used inside PostComposerProvider");
    return ctx;
};
