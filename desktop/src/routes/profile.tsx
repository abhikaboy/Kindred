import { useAuth } from "@/contexts/auth";
import { cn } from "@/lib/utils";
import { ThemedText } from "@/components/ThemedText";
import { ProfileIdentity } from "@/components/profile/ProfileIdentity";
import { ProfileSongWidget } from "@/components/profile/ProfileSongWidget";
import { CompleteProfileCard } from "@/components/profile/CompleteProfileCard";
import { ProfileCheerSection } from "@/components/profile/ProfileCheerSection";
import { ProfileTasks } from "@/components/profile/ProfileTasks";
import { ProfileGallery } from "@/components/profile/ProfileGallery";

// Consistent card wrapper so every profile section reads as one system.
function SectionCard({ children, className }: { children: React.ReactNode; className?: string }) {
    return <section className={cn("rounded-2xl border border-border p-5", className)}>{children}</section>;
}

export default function ProfileScreen() {
    const { user } = useAuth();

    if (!user) return null;

    return (
        <div className="mx-auto flex max-w-5xl flex-col gap-6 pt-6">
            {/* Identity header — avatar, name, actions, and current song together. */}
            <SectionCard className="flex flex-col gap-5 p-6">
                <ProfileIdentity
                    displayName={user.display_name}
                    handle={user.handle}
                    profilePicture={user.profile_picture}
                    friendsCount={user.friends.length}
                />
                <ProfileSongWidget />
            </SectionCard>

            <CompleteProfileCard />

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {/* Main column — what you're doing + what you've done. */}
                <div className="flex flex-col gap-6 lg:col-span-2">
                    <SectionCard>
                        <ProfileCheerSection />
                    </SectionCard>
                    <SectionCard>
                        <ProfileTasks />
                    </SectionCard>
                </div>

                {/* Side column — gallery. */}
                <div className="flex flex-col gap-6">
                    <SectionCard className="flex flex-col gap-3">
                        <ThemedText type="subtitle" as="h3">
                            Gallery
                        </ThemedText>
                        <ProfileGallery userId={user._id} />
                    </SectionCard>
                </div>
            </div>
        </div>
    );
}
