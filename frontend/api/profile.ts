import { useRequest } from "@/hooks/useRequest";
import { Profile } from "./types";

/**
 * Get a profile by id
 */
export const getProfile = async (id: string) => {
    const { request } = useRequest();
    try {
        return (await request("GET", `/Profiles/${id}`)) as Profile;
    } catch (error) {
        console.error("Error fetching profile:", error);
        throw new Error("Failed to fetch profile. Please try again." + error.message);
    }
};
