import React from 'react';
import { useEffect, useState } from 'react';
import { useRouter, type Href } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useOptionalAuth, getAuthData, getCachedUser, getHasEverSignedIn } from '@/hooks/useAuth';
import { enterAsNewGuest, routeForGuest, TABS_ROUTE } from '@/utils/guestEntry';
import EnhancedSplashScreen from '@/components/ui/EnhancedSplashScreen';

/**
 * Entry point that determines where to route the user:
 * - Stored session (or user already in context) -> main app, or the tutorial
 *   for a guest who hasn't finished it
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
    const [nextRoute, setNextRoute] = useState<Href | null>(null);

    useEffect(() => {
        checkInitialRoute();
    }, []);

    const checkInitialRoute = async () => {
        try {
            // Already signed in this launch (e.g. just logged in from /login;
            // tokens may still be mid-write).
            if (user) {
                setNextRoute(user.isGuest ? await routeForGuest(user._id) : TABS_ROUTE);
                return;
            }

            // Stored session: the logged-in layout verifies it and redirects if
            // it has been rejected.
            const [tokens, cached] = await Promise.all([getAuthData(), getCachedUser()]);
            if (tokens) {
                const route = cached?.isGuest ? await routeForGuest(cached._id) : TABS_ROUTE;
                if (route === TABS_ROUTE || !auth) {
                    setNextRoute(route);
                    return;
                }
                // The tutorial sits outside the logged-in layout, so nothing
                // there loads the user; verify here before sending the guest back.
                const result = await auth.fetchAuthData();
                if (result.status === 'authenticated') {
                    setNextRoute(result.user.isGuest ? await routeForGuest(result.user._id) : TABS_ROUTE);
                    return;
                }
                if (result.status === 'unverified-offline') {
                    setNextRoute(result.user ? route : TABS_ROUTE);
                    return;
                }
                // Rejected: the session is gone, continue as signed out.
            }

            // Nobody has ever signed in here: start as a guest (no intro video).
            if (!(await getHasEverSignedIn())) {
                setNextRoute(auth ? await enterAsNewGuest(auth.startGuestSession) : '/login');
                return;
            }

            // ponytail: intro video temporarily disabled — signed-out returning
            // users go straight to login. Restore by un-commenting the block below.
            // const hasSeenIntro = await AsyncStorage.getItem('hasSeenIntroVideo');
            // if (!hasSeenIntro) {
            //     setNextRoute('/intro');
            //     return;
            // }
            setNextRoute('/login');
        } catch (error) {
            console.error('Error checking initial route:', error);
            // Default to login on error
            setNextRoute('/login');
        }
    };

    // Navigate as soon as the route is known; don't wait on a fade
    useEffect(() => {
        if (nextRoute) {
            router.replace(nextRoute);
        }
    }, [nextRoute]);

    return <EnhancedSplashScreen ready={false} />;
}
