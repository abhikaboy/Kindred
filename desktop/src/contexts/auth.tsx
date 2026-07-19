import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import client, { setUnauthorizedHandler } from "@/lib/api/client";
import { tokens } from "@/lib/tokens";
import { decodeIdToken, deriveHandle } from "@/lib/oauth";
import type { components } from "@/lib/api/types.gen";

type SafeUser = components["schemas"]["SafeUser"];

// Backend requires a non-empty profile_picture on register; fall back to the app's default avatar.
const DEFAULT_PICTURE = "https://i.pinimg.com/736x/45/69/cb/4569cb1033f0251fac46f307c3ba495a.jpg";

interface AuthContextValue {
  user: SafeUser | null;
  isLoading: boolean;
  error: string | null;
  sendOTP: (phoneNumber: string) => Promise<void>;
  verifyOTP: (phoneNumber: string, code: string) => Promise<boolean>;
  loginWithOTP: (phoneNumber: string, code: string) => Promise<void>;
  loginWithPhone: (phoneNumber: string, password: string) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  loginWithApple: (idToken: string) => Promise<void>;
  register: (input: {
    display_name: string;
    handle: string;
    email: string;
    phone: string;
    password: string;
    profile_picture?: string;
  }) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SafeUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    setUnauthorizedHandler(() => {
      tokens.clear();
      queryClient.clear();
      setUser(null);
    });

    let cancelled = false;
    async function hydrate() {
      if (!tokens.get()) {
        tokens.clear();
        setIsLoading(false);
        return;
      }
      // Header is injected by the client middleware; passed empty only to satisfy the typed param.
      const { data, error: err } = await client.POST("/v1/user/login", {
        params: { header: { Authorization: "" } },
      });
      if (cancelled) return;
      if (err || !data) {
        tokens.clear();
        setUser(null);
      } else {
        setUser(data);
      }
      setIsLoading(false);
    }
    hydrate();

    return () => {
      cancelled = true;
    };
  }, [queryClient]);

  // Tokens are persisted automatically by the client middleware from response
  // headers, so successful login calls only need setUser(data).

  async function sendOTP(phoneNumber: string) {
    setError(null);
    const { error: err } = await client.POST("/v1/auth/send-otp", {
      body: { phone_number: phoneNumber },
    });
    if (err) {
      const message =
        err.detail || err.title || "Unable to send code. Please try again.";
      setError(message);
      throw new Error(message);
    }
  }

  async function verifyOTP(phoneNumber: string, code: string): Promise<boolean> {
    setError(null);
    const { data, error: err } = await client.POST("/v1/auth/verify-otp", {
      body: { phone_number: phoneNumber, code },
    });
    if (err) {
      const message =
        err.detail || err.title || "Unable to verify code. Please try again.";
      setError(message);
      throw new Error(message);
    }
    return Boolean(data?.valid);
  }

  async function loginWithOTP(phoneNumber: string, code: string) {
    setError(null);
    const { data, error: err, response } = await client.POST(
      "/v1/auth/login/otp",
      { body: { phone_number: phoneNumber, code } }
    );
    if (err || !data) {
      if (response.status === 401) {
        setError("INVALID_OTP");
        throw new Error("INVALID_OTP");
      }
      if (response.status === 404) {
        setError("ACCOUNT_NOT_FOUND");
        throw new Error("ACCOUNT_NOT_FOUND");
      }
      const message =
        (err && (err.detail || err.title)) || "Unable to sign in. Please try again.";
      setError(message);
      throw new Error(message);
    }
    setUser(data);
  }

  async function loginWithPhone(phoneNumber: string, password: string) {
    setError(null);
    const { data, error: err, response } = await client.POST(
      "/v1/auth/login/phone",
      { body: { phone_number: phoneNumber, password } }
    );
    if (err || !data) {
      if (response.status === 404) {
        setError("ACCOUNT_NOT_FOUND");
        throw new Error("ACCOUNT_NOT_FOUND");
      }
      const message =
        (err && (err.detail || err.title)) || "Unable to sign in. Please try again.";
      setError(message);
      throw new Error(message);
    }
    setUser(data);
  }

  const fail = (message: string) => {
    setError(message);
    return new Error(message);
  };

  // Google/Apple both: verify token → login; if no account (404) register then login.
  async function loginWithGoogle(idToken: string) {
    setError(null);
    const p = decodeIdToken(idToken);
    if (!p) throw fail("Invalid Google response. Please try again.");
    const body = { google_id: p.sub, id_token: idToken, email: p.email };
    let res = await client.POST("/v1/auth/login/google", { body });
    if (res.data && !res.error) return setUser(res.data);
    if (res.response.status === 404) {
      const reg = await client.POST("/v1/auth/register/google", {
        body: {
          google_id: p.sub,
          id_token: idToken,
          email: p.email ?? "",
          display_name: p.name || deriveHandle(p.email),
          handle: deriveHandle(p.email),
          profile_picture: p.picture ?? "",
        },
      });
      if (reg.error) throw fail(reg.error.detail || reg.error.title || "Couldn't create your account.");
      res = await client.POST("/v1/auth/login/google", { body });
      if (res.error || !res.data) throw fail("Signed up, but couldn't sign in. Please try again.");
      return setUser(res.data);
    }
    throw fail((res.error && (res.error.detail || res.error.title)) || "Unable to sign in with Google.");
  }

  async function loginWithApple(idToken: string) {
    setError(null);
    const p = decodeIdToken(idToken);
    if (!p) throw fail("Invalid Apple response. Please try again.");
    const body = { apple_id: p.sub, id_token: idToken, email: p.email };
    let res = await client.POST("/v1/auth/login/apple", { body });
    if (res.data && !res.error) return setUser(res.data);
    if (res.response.status === 404) {
      const reg = await client.POST("/v1/auth/register/apple", {
        body: {
          apple_id: p.sub,
          id_token: idToken,
          email: p.email ?? "",
          display_name: p.name || deriveHandle(p.email),
          handle: deriveHandle(p.email),
          profile_picture: p.picture ?? "",
        },
      });
      if (reg.error) throw fail(reg.error.detail || reg.error.title || "Couldn't create your account.");
      res = await client.POST("/v1/auth/login/apple", { body });
      if (res.error || !res.data) throw fail("Signed up, but couldn't sign in. Please try again.");
      return setUser(res.data);
    }
    throw fail((res.error && (res.error.detail || res.error.title)) || "Unable to sign in with Apple.");
  }

  async function register(input: {
    display_name: string;
    handle: string;
    email: string;
    phone: string;
    password: string;
    profile_picture?: string;
  }) {
    setError(null);
    const { data, error: err } = await client.POST("/v1/auth/register", {
      body: {
        display_name: input.display_name,
        handle: input.handle,
        email: input.email,
        phone: input.phone,
        password: input.password,
        profile_picture: input.profile_picture || DEFAULT_PICTURE,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    });
    if (err || !data) {
      const message =
        (err && (err.detail || err.title)) || "Unable to create account. Please try again.";
      setError(message);
      throw new Error(message);
    }
    // Register returns the user + auth tokens (the client middleware persists the tokens
    // from the response headers), so we're signed in immediately — no separate login.
    setUser(data);
  }

  function logout() {
    tokens.clear();
    queryClient.clear();
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        error,
        sendOTP,
        verifyOTP,
        loginWithOTP,
        loginWithPhone,
        loginWithGoogle,
        loginWithApple,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
