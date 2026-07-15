import { LockSimple } from "@phosphor-icons/react";
import { useAuth } from "@/contexts/auth";
import { useRingsToday } from "@/hooks/useRings";
import { ThemedText } from "@/components/ThemedText";
import { ProfileIdentity } from "@/components/profile/ProfileIdentity";
import { ProfileSongWidget } from "@/components/profile/ProfileSongWidget";
import { CompleteProfileCard } from "@/components/profile/CompleteProfileCard";
import { ProfileScoreArc } from "@/components/profile/ProfileScoreArc";
import { ProfileTasks } from "@/components/profile/ProfileTasks";
import { ProfileGallery } from "@/components/profile/ProfileGallery";

export default function ProfileScreen() {
    const { user } = useAuth();
    const rings = useRingsToday();

    if (!user) return null;

    return (
        <div className="mx-auto max-w-5xl pt-4">
            <ProfileIdentity
                displayName={user.display_name}
                handle={user.handle}
                profilePicture={user.profile_picture}
                friendsCount={user.friends.length}
            />

            <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
                {/* Column 1 — profile info + tasks */}
                <div className="flex flex-col gap-6">
                    <ProfileSongWidget />

                    {/* Productivity score — private to the owner. */}
                    <div className="flex flex-col items-center gap-2 rounded-2xl border border-border p-5">
                        <div className="flex items-center gap-1 opacity-60">
                            <LockSimple className="size-3.5" />
                            <ThemedText type="caption">Only visible to you</ThemedText>
                        </div>
                        {!rings.isLoading && <ProfileScoreArc score={rings.data?.productivity_score ?? 0} />}
                    </div>

                    <CompleteProfileCard />

                    <ProfileTasks />
                </div>

                {/* Column 2 — gallery */}
                <div className="flex flex-col gap-3">
                    <ThemedText type="subtitle" as="h3">
                        Gallery
                    </ThemedText>
                    <ProfileGallery userId={user._id} />
                </div>
            </div>
        </div>
    );
}
