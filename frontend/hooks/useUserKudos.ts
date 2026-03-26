import { useAuth } from "@/hooks/useAuth";

const DEFAULT_KUDOS_REWARDS = { encouragements: 0, congratulations: 0 };

export function useUserKudos() {
    const { user } = useAuth();

    return {
        encouragementsLeft: user?.encouragements ?? 0,
        congratulationsLeft: user?.congratulations ?? 0,
        sentEncouragements: user?.kudosRewards?.encouragements ?? 0,
        sentCongratulations: user?.kudosRewards?.congratulations ?? 0,
        currentKudosRewards: user?.kudosRewards ?? DEFAULT_KUDOS_REWARDS,
    };
}
