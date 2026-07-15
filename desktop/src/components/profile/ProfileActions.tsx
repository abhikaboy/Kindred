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
                className="w-auto px-6 py-2.5"
                onClick={() => navigate("/profile/edit")}
            />
            <Link
                to="/friends"
                className="flex items-center justify-center rounded-xl border border-border px-5 py-2.5 transition-opacity hover:opacity-70"
            >
                <ThemedText type="lightBody" className="whitespace-nowrap font-medium">
                    {friendsCount} Friends
                </ThemedText>
            </Link>
        </div>
    );
}
