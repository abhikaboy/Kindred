import { useEffect, useState } from 'react';
import * as Google from 'expo-auth-session/providers/google';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

// Complete the auth session for web browser
WebBrowser.maybeCompleteAuthSession();

export interface GoogleAuthResult {
  type: 'success' | 'error' | 'cancel';
  user?: {
    id: string;
    email: string;
    name: string;
    picture?: string;
    given_name?: string;
    family_name?: string;
  };
  idToken?: string;
  accessToken?: string;
  error?: string;
}

export interface UseGoogleAuthProps {
  onSuccess?: (result: GoogleAuthResult) => void;
  onError?: (error: string) => void;
}

export const useGoogleAuth = (props?: UseGoogleAuthProps) => {
  const [userInfo, setUserInfo] = useState<GoogleAuthResult['user'] | null>(null);
  const [loading, setLoading] = useState(false);

  // Force use of Expo's auth proxy for Expo Go compatibility
  // Manually construct the proxy URL since makeRedirectUri isn't working
  const redirectUri = __DEV__
    ? 'https://auth.expo.io/@suntex/Kindred'  // Expo Go proxy
    : AuthSession.makeRedirectUri({
        scheme: 'com.googleusercontent.apps.955300435674-4unacg9mbosj1sdf3gqb17lb6rasqmj6'
      });

  console.log('🔗 Google OAuth Redirect URI:', redirectUri);
  console.log('🔗 Using expoClientId for Expo Go');
  console.log('🔗 __DEV__ mode:', __DEV__);

  // Configure Google Auth Request
  const [request, response, promptAsync] = Google.useAuthRequest(
    {
      expoClientId: '955300435674-5jut5auaic2u4k8udu6spkqf1b13uau8.apps.googleusercontent.com', // For Expo Go
      iosClientId: '955300435674-4unacg9mbosj1sdf3gqb17lb6rasqmj6.apps.googleusercontent.com', // For standalone iOS
      webClientId: '955300435674-5jut5auaic2u4k8udu6spkqf1b13uau8.apps.googleusercontent.com', // For web/Android
      scopes: ['openid', 'profile', 'email'],
    },
    {
      // Discovery document for Google OAuth
      useProxy: true, // Force use of Expo proxy
      redirectUri: redirectUri, // Explicitly use the proxy redirect
    }
  );

  // Handle the authentication response
  useEffect(() => {
    if (response?.type === 'success') {
      setLoading(true);
      fetchUserInfo(response.params.id_token)
        .then((result) => {
          setUserInfo(result.user);
          props?.onSuccess?.(result);
        })
        .catch((error) => {
          console.error('Google auth error:', error);
          const errorMessage = error.message || 'Failed to authenticate with Google';
          props?.onError?.(errorMessage);
        })
        .finally(() => {
          setLoading(false);
        });
    } else if (response?.type === 'error') {
      const errorMessage = response.error?.message || 'Authentication failed';
      console.error('Google auth error:', response.error);
      props?.onError?.(errorMessage);
    }
  }, [response]);

  const fetchUserInfo = async (idToken: string): Promise<GoogleAuthResult> => {
    if (!idToken) {
      throw new Error('No ID token received');
    }

    try {
      // Decode the ID token to get user info (JWT payload)
      const base64Payload = idToken.split('.')[1];
      const payload = JSON.parse(atob(base64Payload));

      const user = {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
        given_name: payload.given_name,
        family_name: payload.family_name,
      };

      return {
        type: 'success',
        user,
        idToken,
      };
    } catch (error) {
      console.error('Failed to parse Google ID token:', error);
      throw new Error('Failed to parse user information');
    }
  };

  const signInAsync = async (): Promise<GoogleAuthResult> => {
    try {
      setLoading(true);
      const result = await promptAsync();

      if (result.type === 'success') {
        const userResult = await fetchUserInfo(result.params.id_token);
        setUserInfo(userResult.user);
        return userResult;
      } else if (result.type === 'cancel') {
        return { type: 'cancel' };
      } else {
        return {
          type: 'error',
          error: 'Authentication failed'
        };
      }
    } catch (error) {
      console.error('Google sign in error:', error);
      return {
        type: 'error',
        error: error instanceof Error ? error.message : 'Authentication failed'
      };
    } finally {
      setLoading(false);
    }
  };

  const signOut = () => {
    setUserInfo(null);
  };

  return {
    request,
    response,
    promptAsync,
    signInAsync,
    signOut,
    userInfo,
    loading,
    isReady: !!request,
  };
};

export default useGoogleAuth;
