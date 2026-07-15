import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import client, { setUnauthorizedHandler } from "@/lib/api/client";
import { tokens } from "@/lib/tokens";
import type { components } from "@/lib/api/types.gen";

type SafeUser = components["schemas"]["SafeUser"];

interface AuthContextValue {
  user: SafeUser | null;
  isLoading: boolean;
  error: string | null;
  sendOTP: (phoneNumber: string) => Promise<void>;
  verifyOTP: (phoneNumber: string, code: string) => Promise<boolean>;
  loginWithOTP: (phoneNumber: string, code: string) => Promise<void>;
  loginWithPhone: (phoneNumber: string, password: string) => Promise<void>;
  register: (input: {
    display_name: string;
    handle: string;
    email: string;
    phone: string;
    password: string;
  }) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SafeUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      tokens.clear();
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
  }, []);

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

  async function register(input: {
    display_name: string;
    handle: string;
    email: string;
    phone: string;
    password: string;
  }) {
    setError(null);
    const { error: err } = await client.POST("/v1/auth/register", {
      body: {
        display_name: input.display_name,
        handle: input.handle,
        email: input.email,
        phone: input.phone,
        password: input.password,
        profile_picture: "",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    });
    if (err) {
      const message =
        err.detail || err.title || "Unable to create account. Please try again.";
      setError(message);
      throw new Error(message);
    }
    // Register returns no tokens; authenticate via phone login.
    await loginWithPhone(input.phone, input.password);
  }

  function logout() {
    tokens.clear();
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
