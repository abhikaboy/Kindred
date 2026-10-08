import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "@phosphor-icons/react";
import { useAuth } from "@/contexts/auth";
import { ThemedText } from "@/components/ThemedText";
import ThemedInput from "@/components/ThemedInput";
import PrimaryButton from "@/components/PrimaryButton";
import { AuthShell } from "@/components/auth/AuthShell";
import { PhoneInput } from "@/components/PhoneInput";
import { OtpInput } from "@/components/OtpInput";
import { formatPhone } from "@/lib/formatPhone";

type Step = "phone" | "otp" | "profile";

export default function RegisterScreen() {
  const { sendOTP, verifyOTP, register } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

  const getTitle = () =>
    step === "profile" ? "Create your account" : "Verify your phone";

  const handleSendCode = async () => {
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

  const handleVerifyOtp = async (code?: string) => {
    const value = code ?? otpCode;
    if (value.length !== 4) {
      setError("Please enter the 4-digit code");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const ok = await verifyOTP(phone, value);
      if (ok) {
        setStep("profile");
      } else {
        setError("Invalid code. Please try again.");
      }
    } catch {
      setError("Invalid code. Please try again.");
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

  const handleRegister = async () => {
    if (!displayName || !handle || !email || !password) {
      setError("Please fill in all fields");
      return;
    }
    setLoading(true);
    setError("");
    try {
      // Handle carries its own leading @; do not prepend one.
      await register({
        display_name: displayName,
        handle,
        email,
        phone,
        password,
      });
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create account.");
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (step === "profile") setStep("otp");
    else if (step === "otp") setStep("phone");
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
            <PhoneInput value={phone} onChangeText={setPhone} autoFocus />

            <PrimaryButton
              title="Send code"
              onClick={handleSendCode}
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
              onFilled={handleVerifyOtp}
              disabled={loading}
              autoFocus
            />

            <PrimaryButton
              title={loading ? "Verifying…" : "Verify"}
              onClick={() => handleVerifyOtp()}
              disabled={loading || otpCode.length !== 4}
            />

            <div className="flex items-center gap-4">
              {canResend ? (
                <button type="button" onClick={handleResend}>
                  <ThemedText type="caption" className="text-primary">Resend code</ThemedText>
                </button>
              ) : (
                <ThemedText type="caption" className="tabular-nums">Resend code in {resendTimer}s</ThemedText>
              )}
            </div>
          </div>
        )}

        {step === "profile" && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col items-start gap-1.5">
              <ThemedText type="defaultSemiBold" as="label">
                Name
              </ThemedText>
              <ThemedInput
                value={displayName}
                onChange={setDisplayName}
                placeholder="Your name"
                autoFocus
              />
            </div>
            <div className="flex flex-col items-start gap-1.5">
              <ThemedText type="defaultSemiBold" as="label">
                Handle
              </ThemedText>
              <ThemedInput
                value={handle}
                onChange={setHandle}
                placeholder="@yourhandle"
              />
            </div>
            <div className="flex flex-col items-start gap-1.5">
              <ThemedText type="defaultSemiBold" as="label">
                Email
              </ThemedText>
              <ThemedInput
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="you@example.com"
              />
            </div>
            <div className="flex flex-col items-start gap-1.5">
              <ThemedText type="defaultSemiBold" as="label">
                Password
              </ThemedText>
              <ThemedInput
                secureTextEntry
                value={password}
                onChange={setPassword}
                placeholder="Create a password"
                onSubmit={handleRegister}
              />
            </div>

            <PrimaryButton
              title={loading ? "Creating account…" : "Create account"}
              onClick={handleRegister}
              disabled={loading}
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
            <ThemedText type="caption">Already have an account?</ThemedText>
            <Link to="/login">
              <ThemedText type="link">Sign in</ThemedText>
            </Link>
          </div>
        )}
    </AuthShell>
  );
}
