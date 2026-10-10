import React, { createContext, useContext } from "react";
import { useOnboardingV2 } from "@/hooks/useOnboardingV2";

type OnboardingV2ContextType = ReturnType<typeof useOnboardingV2>;

const OnboardingV2Context = createContext<OnboardingV2ContextType | undefined>(undefined);

/** Mount once above the tabs so Home and the workspace screens share one v2 state. */
export function OnboardingV2Provider({
    children,
    hasNoWorkspaces,
    ready,
}: {
    children: React.ReactNode;
    hasNoWorkspaces: boolean;
    ready: boolean;
}) {
    const value = useOnboardingV2({ hasNoWorkspaces, ready });
    return <OnboardingV2Context.Provider value={value}>{children}</OnboardingV2Context.Provider>;
}

/** Outside the provider (e.g. the legacy tutorial route) dispatch is a no-op, so nothing crashes. */
const DETACHED: OnboardingV2ContextType = {
    step: null,
    state: null,
    isGuest: false,
    dispatch: () => {},
    isLoading: false,
};

export function useOnboardingV2Context(): OnboardingV2ContextType {
    return useContext(OnboardingV2Context) ?? DETACHED;
}
