import { useState } from "react";
import { useTypedMutation } from "@/hooks/useTypedAPI";
import { components } from "@/api/generated/types";

// Use types from generated schema
type SendOTPRequest = components["schemas"]["SendOTPRequest"];
type VerifyOTPRequest = components["schemas"]["VerifyOTPRequest"];

export interface UseVerificationReturn {
    // Send OTP
    sendOTP: (phoneNumber: string) => Promise<void>;
    sendingOTP: boolean;
    sendOTPError: string | null;
    verificationId: string | null;

    // Verify OTP
    verifyOTP: (phoneNumber: string, code: string) => Promise<boolean>;
    verifyingOTP: boolean;
    verifyOTPError: string | null;
    isVerified: boolean;

    // Reset functions
    resetSendOTP: () => void;
    resetVerifyOTP: () => void;
    reset: () => void;
}

export const useVerification = (): UseVerificationReturn => {
    const [verificationId, setVerificationId] = useState<string | null>(null);
    const [isVerified, setIsVerified] = useState(false);
    const [sendOTPError, setSendOTPError] = useState<string | null>(null);
    const [verifyOTPError, setVerifyOTPError] = useState<string | null>(null);

    // Send OTP mutation
    const sendOTPMutation = useTypedMutation("post", "/v1/auth/send-otp");

    // Verify OTP mutation
    const verifyOTPMutation = useTypedMutation("post", "/v1/auth/verify-otp");

    /**
     * Send OTP to the provided phone number
     * @param phoneNumber - Phone number in E.164 format (e.g., +16097751922)
     */
    const sendOTP = async (phoneNumber: string): Promise<void> => {
        try {
            setSendOTPError(null);
            setVerificationId(null);

            const result = await sendOTPMutation.mutateAsync({
                body: {
                    phone_number: phoneNumber,
                } as SendOTPRequest,
            });

            // Extract verification ID from response
            if (result && typeof result === "object" && "verification_id" in result) {
                setVerificationId(result.verification_id as string);
            }

            console.log("OTP sent successfully:", result);
        } catch (error: any) {
            console.error("Failed to send OTP:", error);
            const errorMessage = error?.message || "Failed to send OTP. Please try again.";
            setSendOTPError(errorMessage);
            throw error;
        }
    };

    /**
     * Verify OTP code for the provided phone number
     * @param phoneNumber - Phone number in E.164 format (e.g., +16097751922)
     * @param code - The OTP code received via SMS
     * @returns boolean indicating if verification was successful
     */
    const verifyOTP = async (phoneNumber: string, code: string): Promise<boolean> => {
        try {
            setVerifyOTPError(null);
            setIsVerified(false);

            const result = await verifyOTPMutation.mutateAsync({
                body: {
                    phone_number: phoneNumber,
                    code: code,
                } as VerifyOTPRequest,
            });

            // Check if verification was successful
            const valid = result && typeof result === "object" && "valid" in result 
                ? (result.valid as boolean) 
                : false;

            setIsVerified(valid);

            if (valid) {
                console.log("OTP verified successfully:", result);
            } else {
                const errorMsg = "Invalid OTP code. Please try again.";
                setVerifyOTPError(errorMsg);
                console.error("OTP verification failed:", result);
            }

            return valid;
        } catch (error: any) {
            console.error("Failed to verify OTP:", error);
            const errorMessage = error?.message || "Failed to verify OTP. Please try again.";
            setVerifyOTPError(errorMessage);
            setIsVerified(false);
            throw error;
        }
    };

    /**
     * Reset send OTP state
     */
    const resetSendOTP = () => {
        setSendOTPError(null);
        setVerificationId(null);
        sendOTPMutation.reset();
    };

    /**
     * Reset verify OTP state
     */
    const resetVerifyOTP = () => {
        setVerifyOTPError(null);
        setIsVerified(false);
        verifyOTPMutation.reset();
    };

    /**
     * Reset all verification state
     */
    const reset = () => {
        resetSendOTP();
        resetVerifyOTP();
    };

    return {
        // Send OTP
        sendOTP,
        sendingOTP: sendOTPMutation.isPending,
        sendOTPError,
        verificationId,

        // Verify OTP
        verifyOTP,
        verifyingOTP: verifyOTPMutation.isPending,
        verifyOTPError,
        isVerified,

        // Reset functions
        resetSendOTP,
        resetVerifyOTP,
        reset,
    };
};
