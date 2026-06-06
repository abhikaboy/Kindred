// A user's `handle` already includes the leading `@`. This guards against
// legacy/edge values that don't, without double-prepending.
export const formatHandle = (handle: string): string =>
    handle.startsWith("@") ? handle : `@${handle}`;
