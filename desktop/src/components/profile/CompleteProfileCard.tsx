import { Camera } from "@phosphor-icons/react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/auth";
import { ThemedText } from "@/components/ThemedText";

const DEFAULT_PICTURE = "https://i.pinimg.com/736x/45/69/cb/4569cb1033f0251fac46f307c3ba495a.jpg";

// Nudge to add a real photo; hides once a custom avatar is set. Mobile uploads
// inline — desktop routes to the edit page (no image-picker port yet).
export function CompleteProfileCard() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const hasCustomPhoto = user?.profile_picture && user.profile_picture !== DEFAULT_PICTURE;
    if (hasCustomPhoto) return null;

    return (
        <button
            onClick={() => navigate("/profile/edit")}
            className="flex w-full items-center gap-3 rounded-xl border border-primary/30 bg-primary/[0.08] p-3.5 text-left transition-opacity hover:opacity-80"
        >
            <span className="grid size-10 place-items-center rounded-full bg-primary/20">
                <Camera className="size-5 text-primary" />
            </span>
            <span className="flex flex-col">
                <ThemedText>Add a profile photo</ThemedText>
                <ThemedText type="caption">Stand out with a real photo</ThemedText>
            </span>
        </button>
    );
}
