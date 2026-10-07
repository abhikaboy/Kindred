import { Link } from "react-router-dom";
import { CheckCircle, HandsClapping, PencilSimple, Users } from "@phosphor-icons/react";
import { useAuth } from "@/contexts/auth";
import { ThemedText } from "@/components/ThemedText";
import { ProfileHero } from "@/components/profile/ProfileHero";
import { CompleteProfileCard } from "@/components/profile/CompleteProfileCard";
import { ProfileCheerSection } from "@/components/profile/ProfileCheerSection";
import { ProfileTasks } from "@/components/profile/ProfileTasks";
import { ProfileGallery } from "@/components/profile/ProfileGallery";
import { ProfileKudos } from "@/components/profile/ProfileKudos";
import { useRingsToday } from "@/hooks/useRings";

export default function ProfileScreen() {
  const { user } = useAuth();
  const { data: rings } = useRingsToday();

  if (!user) return null;
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-12 pt-6">
      <ProfileHero
        userId={user._id}
        displayName={user.display_name}
        handle={user.handle}
        picture={user.profile_picture}
        rings={rings?.ring_state}
        song={user.song}
        editable
        stats={[
          { icon: CheckCircle, value: user.tasks_complete, label: "done" },
          { icon: HandsClapping, value: user.encouragements + user.congratulations, label: "kudos" },
          { icon: Users, value: user.friends.length, label: "friends", to: "/search" },
        ]}
        actions={
          <Link
            to="/profile/edit"
            className="inline-flex h-8 w-fit items-center gap-1.5 rounded-full bg-muted/70 px-3 text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
          >
            <PencilSimple size={14} />
            <ThemedText type="caption" className="text-inherit">
              Edit profile
            </ThemedText>
          </Link>
        }
      />

      <CompleteProfileCard />

      <section className="flex flex-col gap-3">
        <ThemedText type="subtitle" as="h2">
          Gallery
        </ThemedText>
        <ProfileGallery userId={user._id} />
      </section>

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-5">
        <div className="flex flex-col gap-12 lg:col-span-3">
          <ProfileCheerSection />
          <ProfileTasks />
        </div>
        <div className="lg:col-span-2">
          <ProfileKudos />
        </div>
      </div>
    </div>
  );
}
