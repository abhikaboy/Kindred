import React from 'react';
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useOptionalAuth, getAuthData, getCachedUser, getHasEverSignedIn } from '@/hooks/useAuth';
import { enterAsNewGuest, routeForGuest, TABS_ROUTE } from '@/utils/guestEntry';
import SplashHold from '@/components/ui/SplashHold';
import { maybeForceFirstLaunch } from '@/utils/resetFirstLaunch';

/**
 * Entry point that determines where to route the user:
 * - Stored session (or user already in context) -> main app (guests included)
 * - No session, never signed in on this device -> new guest session
 * - No session, signed in before (logged out) -> login
 *
 * Decides from storage rather than the context user, which is still null on a
 * cold start because nothing has loaded auth before this screen mounts.
 */
export default function Index() {
    const router = useRouter();
    const auth = useOptionalAuth();
    const user = auth?.user ?? null;

    // Intentionally mount-only: runs before the auth context has loaded.
    useEffect(() => {
        let cancelled = false;

        const checkInitialRoute = async () => {
            try {
                await maybeForceFirstLaunch();

                // Already signed in this launch (e.g. just logged in from /login;
                // tokens may still be mid-write).
                if (user) {
                    const route = user.isGuest ? await routeForGuest(user._id) : TABS_ROUTE;
                    if (!cancelled) router.replace(route);
                    return;
                }

                // Stored session: the logged-in layout verifies it and redirects if
                // it has been rejected.
                const [tokens, cached] = await Promise.all([getAuthData(), getCachedUser()]);
                if (tokens) {
                    const route = cached?.isGuest ? await routeForGuest(cached._id) : TABS_ROUTE;
                    if (route === TABS_ROUTE || !auth) {
                        if (!cancelled) router.replace(route);
                        return;
                    }
                    // Outside the logged-in layout nothing loads the user; verify here.
                    const result = await auth.fetchAuthData();
                    if (cancelled) return;
                    if (result.status === 'authenticated') {
                        const route = result.user.isGuest
                            ? await routeForGuest(result.user._id)
                            : TABS_ROUTE;
                        if (!cancelled) router.replace(route);
                        return;
                    }
                    if (result.status === 'unverified-offline') {
                        if (!cancelled) router.replace(result.user ? route : TABS_ROUTE);
                        return;
                    }
                    // Rejected: the session is gone, continue as signed out.
                }

                // Nobody has ever signed in here: start as a guest (no intro video).
                if (!(await getHasEverSignedIn())) {
                    const route = auth ? await enterAsNewGuest(auth.startGuestSession) : '/login';
                    if (!cancelled) router.replace(route);
                    return;
                }

                // Signed-out returning users go straight to login.
                if (!cancelled) router.replace('/login');
            } catch (error) {
                console.error('Error checking initial route:', error);
                // Default to login on error
                if (!cancelled) router.replace('/login');
            }
        };

        checkInitialRoute();
        return () => {
            cancelled = true;
        };
    }, []);

    return <SplashHold />;
}
