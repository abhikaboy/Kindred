import { useEffect, useState, useRef, useCallback } from "react";
import {
  GoogleSignin,
  statusCodes,
  isErrorWithCode,
} from "@react-native-google-signin/google-signin";

export interface GoogleAuthResult {
  type: "success" | "error" | "cancel";
  user?: {
    id: string;
    email: string;
    name: string;
    picture?: string;
    given_name?: string;
    family_name?: string;
  };
  idToken?: string;
  error?: string;
}

export interface UseGoogleAuthProps {
  onSuccess?: (result: GoogleAuthResult) => void;
  onError?: (error: string) => void;
}

export const useGoogleAuth = (props?: UseGoogleAuthProps) => {
  const [userInfo, setUserInfo] = useState<GoogleAuthResult["user"] | null>(null);
  const [loading, setLoading] = useState(false);
  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => {
    GoogleSignin.configure({
      iosClientId:
        "955300435674-4unacg9mbosj1sdf3gqb17lb6rasqmj6.apps.googleusercontent.com",
      webClientId:
        "955300435674-5jut5auaic2u4k8udu6spkqf1b13uau8.apps.googleusercontent.com",
    });
  }, []);

  const signInAsync = useCallback(async (): Promise<GoogleAuthResult> => {
    try {
      setLoading(true);
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();

      if (response.type === "cancelled") {
        return { type: "cancel" };
      }

      const { user: googleUser } = response.data!;
      const user = {
        id: googleUser.id,
        email: googleUser.email,
        name: googleUser.name ?? "",
        picture: googleUser.photo ?? undefined,
        given_name: googleUser.givenName ?? undefined,
        family_name: googleUser.familyName ?? undefined,
      };

      setUserInfo(user);

      const result: GoogleAuthResult = {
        type: "success",
        user,
        idToken: response.data?.idToken ?? undefined,
      };

      propsRef.current?.onSuccess?.(result);
      return result;
    } catch (error) {
      if (isErrorWithCode(error)) {
        if (error.code === statusCodes.SIGN_IN_CANCELLED) {
          return { type: "cancel" };
        }
        if (error.code === statusCodes.IN_PROGRESS) {
          return { type: "cancel" };
        }
      }

      const errorMessage =
        error instanceof Error ? error.message : "Google sign-in failed";
      propsRef.current?.onError?.(errorMessage);
      return { type: "error", error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await GoogleSignin.signOut();
    } catch {
      // silent
    }
    setUserInfo(null);
  }, []);

  return {
    signInAsync,
    signOut,
    userInfo,
    loading,
    isReady: true, // native SDK is always ready after configure
  };
};

export default useGoogleAuth;
