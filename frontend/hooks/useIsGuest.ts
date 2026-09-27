import { useAuth } from "@/hooks/useAuth";

// Whether the signed-in session is a guest (no real account yet).
export function useIsGuest(): boolean {
    return useAuth().isGuest;
}
