import type { ReactNode } from "react";
import { ThemedText } from "@/components/ThemedText";
import { ProfileActions } from "@/components/profile/ProfileActions";

const DEFAULT_PICTURE = "https://i.pinimg.com/736x/45/69/cb/4569cb1033f0251fac46f307c3ba495a.jpg";

type Props = {
    displayName: string;
    handle: string;
    profilePicture?: string;
    friendsCount?: number;
    /** Right-side actions. Defaults to the owner's Edit/Friends actions. */
    actions?: ReactNode;
};

// Circular avatar, name/handle, and actions on the right (no banner).
export function ProfileIdentity({ displayName, handle, profilePicture, friendsCount, actions }: Props) {
    const hasPhoto = Boolean(profilePicture) && profilePicture !== DEFAULT_PICTURE;
    return (
        <div className="flex flex-wrap items-end gap-4 px-2 pt-2">
            <div className="size-28 shrink-0 overflow-hidden rounded-full bg-secondary ring-4 ring-background">
                {hasPhoto ? (
                    <img src={profilePicture} alt="" className="size-full object-cover" />
                ) : (
                    <div className="size-full bg-gradient-to-br from-primary/40 to-muted" />
                )}
            </div>
            <div className="mb-1 min-w-0 flex-1">
                <ThemedText as="h1" type="hero" className="truncate leading-none">
                    {displayName || "—"}
                </ThemedText>
                <ThemedText type="caption" className="mt-1 block">
                    {handle}
                </ThemedText>
            </div>
            <div className="mb-1">
                {actions ?? <ProfileActions friendsCount={friendsCount ?? 0} />}
            </div>
        </div>
    );
}
