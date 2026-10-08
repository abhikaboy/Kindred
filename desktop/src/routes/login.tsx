import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import { AppleLogo, ArrowLeft } from "@phosphor-icons/react";
import { useAuth } from "@/contexts/auth";
import { signInWithApple, appleConfigured } from "@/lib/oauth";
import { ThemedText } from "@/components/ThemedText";
import ThemedInput from "@/components/ThemedInput";
import PrimaryButton from "@/components/PrimaryButton";
import { AuthShell } from "@/components/auth/AuthShell";
import { PhoneInput } from "@/components/PhoneInput";
import { OtpInput } from "@/components/OtpInput";
import { cn } from "@/lib/utils";
import { formatPhone } from "@/lib/formatPhone";

type Step = "phone" | "otp" | "password";

// Shared look for the social auth buttons — mirrors mobile's OnboardModal styling.
const SOCIAL_BUTTON_CLASS =
  "rounded-xl border border-border bg-background py-3 text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:bg-muted";

// Google's official "G" mark — no brand-color equivalent in phosphor-icons.
function GoogleGLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12
        c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4
        C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20
        C44,22.659,43.862,21.35,43.611,20.083z"
      />
      <path
        fill="#FF3D00"
        d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039
        l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36
        c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"
      />
      <path
        fill="#1976D2"
        d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571
        c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24
        C44,22.659,43.862,21.35,43.611,20.083z"
      />
    </svg>
  );
}

export default function LoginScreen() {
  const { sendOTP, loginWithOTP, loginWithPhone, loginWithGoogle, loginWithApple } = useAuth();
  const navigate = useNavigate();

  const [phone, setPhone] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<Step>("phone");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendTimer, setResendTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);

  // Resend countdown while on the OTP step.
  useEffect(() => {
    if (step !== "otp") return;
    if (resendTimer <= 0) {
      setCanResend(true);
      return;
    }
    const timer = setTimeout(() => setResendTimer((t) => t - 1), 1000);
    return () => clearTimeout(timer);
  }, [step, resendTimer]);

  const getTitle = () => {
    if (step === "otp") return "Enter code";
    if (step === "password") return "Enter password";
    return "Welcome back";
  };

  const mapLoginError = (err: unknown, fallback: string) => {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "INVALID_OTP") return "Invalid or expired code. Please try again.";
    if (msg === "ACCOUNT_NOT_FOUND")
      return "No account found with this phone number. Sign up first!";
    return msg || fallback;
  };

  const handleContinuePhone = async () => {
    if (!phone) {
      setError("Please enter your phone number");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await sendOTP(phone);
      setStep("otp");
      setResendTimer(30);
      setCanResend(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send a code. Give it another try.");
    } finally {
      setLoading(false);
    }
  };

  const handleLoginOtp = async (code?: string) => {
    const value = code ?? otpCode;
    if (value.length !== 4) {
      setError("Please enter the 4-digit code");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await loginWithOTP(phone, value);
      navigate("/", { replace: true });
    } catch (err) {
      setError(mapLoginError(err, "Login failed. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const handleLoginPassword = async () => {
    if (!password) {
      setError("Please enter your password");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await loginWithPhone(phone, password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(
        mapLoginError(err, "Invalid phone number or password. Please try again.")
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async (credential: string) => {
    setLoading(true);
    setError("");
    try {
      await loginWithGoogle(credential);
      navigate("/", { replace: true });
    } catch (err) {
      setError(mapLoginError(err, "Google sign-in failed. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const handleApple = async () => {
    setLoading(true);
    setError("");
    try {
      const idToken = await signInWithApple();
      await loginWithApple(idToken);
      navigate("/", { replace: true });
    } catch (err) {
      setError(mapLoginError(err, "Apple sign-in failed. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!canResend) return;
    setCanResend(false);
    setResendTimer(30);
    setOtpCode("");
    setError("");
    try {
      await sendOTP(phone);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't resend the code. Give it another try.");
      setCanResend(true);
      setResendTimer(0);
    }
  };

  const handleBack = () => {
    setStep("phone");
    setOtpCode("");
    setPassword("");
    setError("");
  };

  const usePassword = () => {
    setStep("password");
    setOtpCode("");
    setError("");
  };

  return (
    <AuthShell>
        {step !== "phone" && (
          <button
            type="button"
            onClick={handleBack}
            aria-label="Back"
            className="-mb-4 -ml-2 grid size-9 place-items-center self-start rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft size={20} />
          </button>
        )}

        <div className="flex flex-col gap-2">
          <ThemedText type="titleFraunces" as="h1">
            {getTitle()}
          </ThemedText>
          {step === "otp" && <ThemedText type="caption">Sent to {formatPhone(phone)}</ThemedText>}
        </div>

        {step === "phone" && (
          <div className="flex flex-col gap-3">
            {/* The visible button is a plain look-alike; the real GoogleLogin sits on
                top, fully transparent, so clicks still trigger Google's real ID-token
                flow while the styling matches the Apple button below. */}
            <div className="relative">
              <PrimaryButton
                title="Continue with Google"
                className={cn(SOCIAL_BUTTON_CLASS, "pointer-events-none")}
              >
                <GoogleGLogo />
              </PrimaryButton>
              <div
                className={cn(
                  "absolute inset-0 overflow-hidden rounded-xl opacity-0",
                  loading && "pointer-events-none",
                )}
              >
                <GoogleLogin
                  onSuccess={(cred) => cred.credential && handleGoogle(cred.credential)}
                  onError={() => setError("Google sign-in failed. Please try again.")}
                  width="384"
                />
              </div>
            </div>

            {appleConfigured && (
              <PrimaryButton
                title="Continue with Apple"
                onClick={handleApple}
                disabled={loading}
                className={SOCIAL_BUTTON_CLASS}
              >
                <AppleLogo weight="fill" size={20} />
              </PrimaryButton>
            )}
            <div className="my-3 flex items-center gap-3">
              <span className="h-px flex-1 bg-border" />
              <ThemedText type="caption">or</ThemedText>
              <span className="h-px flex-1 bg-border" />
            </div>

            <PhoneInput value={phone} onChangeText={setPhone} autoFocus />

            <PrimaryButton
              title="Send code"
              onClick={handleContinuePhone}
              disabled={loading || !phone}
            />
          </div>
        )}

        {step === "otp" && (
          <div className="flex flex-col gap-3">
            <OtpInput
              numberOfDigits={4}
              onTextChange={(text) => {
                setOtpCode(text);
                if (error) setError("");
              }}
              onFilled={handleLoginOtp}
              disabled={loading}
              autoFocus
            />

            <PrimaryButton
              title={loading ? "Logging in…" : "Log in"}
              onClick={() => handleLoginOtp()}
              disabled={loading || otpCode.length !== 4}
            />

            <div className="flex items-center justify-between gap-4">
              {canResend ? (
                <button type="button" onClick={handleResend}>
                  <ThemedText type="caption" className="text-primary">Resend code</ThemedText>
                </button>
              ) : (
                <ThemedText type="caption" className="tabular-nums">Resend code in {resendTimer}s</ThemedText>
              )}
              <button type="button" onClick={usePassword} className="group">
                <ThemedText type="caption" className="transition-colors group-hover:text-foreground">
                  Use a password instead
                </ThemedText>
              </button>
            </div>
          </div>
        )}

        {step === "password" && (
          <div className="flex flex-col gap-4">
            <ThemedInput
              secureTextEntry
              value={password}
              onChange={(v) => {
                setPassword(v);
                if (error) setError("");
              }}
              placeholder="Enter your password"
              autoFocus
              onSubmit={handleLoginPassword}
            />

            <PrimaryButton
              title={loading ? "Logging in…" : "Log in"}
              onClick={handleLoginPassword}
              disabled={loading || !password}
            />
          </div>
        )}

        {error && (
          <ThemedText type="caption" className="text-destructive">
            {error}
          </ThemedText>
        )}

        {step === "phone" && (
          <div className="flex flex-row items-center gap-1">
            <ThemedText type="caption">Don't have an account?</ThemedText>
            <Link to="/register">
              <ThemedText type="link">Create one</ThemedText>
            </Link>
          </div>
        )}
    </AuthShell>
  );
}
