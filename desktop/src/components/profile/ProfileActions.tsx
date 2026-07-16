import { Link, useNavigate } from "react-router-dom";
import PrimaryButton from "@/components/PrimaryButton";
import { ThemedText } from "@/components/ThemedText";

// Mobile ProfileEdit: "Edit Profile" button + "{n} Friends" pill, side by side.
export function ProfileActions({ friendsCount }: { friendsCount: number }) {
    const navigate = useNavigate();
    return (
        <div className="flex gap-3">
            <PrimaryButton
                title="Edit Profile"
                className="h-11 w-auto px-6 py-0"
                onClick={() => navigate("/profile/edit")}
            />
            <Link
                to="/search"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-border px-6 transition-opacity hover:opacity-70"
            >
                <ThemedText type="lightBody" className="whitespace-nowrap font-medium">
                    {friendsCount} Friends
                </ThemedText>
            </Link>
        </div>
    );
}
