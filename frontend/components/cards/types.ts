// Tagged-user reference as stored on a post; mirrors the backend MentionReference.
// name/icon are optional — older posts only carry id + handle.
export type TaggedUser = {
    id: string;
    handle: string;
    name?: string;
    icon?: string;
};
