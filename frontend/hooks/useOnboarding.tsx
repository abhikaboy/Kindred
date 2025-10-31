import React, { createContext, useContext, useState, ReactNode } from 'react';
import { useTypedMutation } from './useTypedAPI';
import { useAuth } from './useAuth';
import client from '@/api/client';

// Onboarding data interface
export interface OnboardingData {
    email: string;
    phone: string;
    password: string;
    displayName: string;
    handle: string;
    profilePicture: string;
    appleId?: string;
    googleId?: string;
}

// Validation error interface
export interface ValidationErrors {
    email?: string;
    password?: string;
    displayName?: string;
    handle?: string;
    profilePicture?: string;
}

interface OnboardingContextType {
    // State
    onboardingData: OnboardingData;
    validationErrors: ValidationErrors;
    isLoading: boolean;
    
    // Update functions
    updateEmail: (email: string) => void;
    updatePassword: (password: string) => void;
    updateDisplayName: (displayName: string) => void;
    updateHandle: (handle: string) => void;
    updateProfilePicture: (profilePicture: string) => void;
    updateAppleId: (appleId: string) => void;
    updateGoogleId: (googleId: string) => void;
    
    // Bulk update
    updateOnboardingData: (data: Partial<OnboardingData>) => void;
    
    // Validation
    validateEmail: (email: string) => string | null;
    validatePassword: (password: string) => string | null;
    validateDisplayName: (displayName: string) => string | null;
    validateHandle: (handle: string) => string | null;
    validateProfilePicture: (profilePicture: string) => string | null;
    validateAll: () => boolean;
    
    // Registration
    registerWithEmail: (profilePictureUrl?: string) => Promise<void>;
    registerWithApple: (profilePictureUrl?: string) => Promise<void>;
    registerWithGoogle: () => Promise<void>;
    
    // Reset
    reset: () => void;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

const initialData: OnboardingData = {
    email: '',
    phone: '',
    password: '',
    displayName: '',
    handle: '',
    profilePicture: '',
    appleId: '',
    googleId: '',
};

export function OnboardingProvider({ children }: { children: ReactNode }) {
    const [onboardingData, setOnboardingData] = useState<OnboardingData>(initialData);
    const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
    const [isLoading, setIsLoading] = useState(false);
    
    const { register, registerWithGoogle: authRegisterWithGoogle, setUser } = useAuth();
    
    // Mutations
    const emailRegisterMutation = useTypedMutation("post", "/v1/auth/register" as any);
    const appleRegisterMutation = useTypedMutation("post", "/v1/auth/register/apple");
    const googleRegisterMutation = useTypedMutation("post", "/v1/auth/register/google" as any);

    // Validation functions
    const validateEmail = (email: string): string | null => {
        // Email is optional - if empty, it's valid
        if (!email) {
            return null;
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return 'Please enter a valid email address';
        }
        return null;
    };

    const validatePassword = (password: string): string | null => {
        if (!password) {
            return 'Password is required';
        }
        if (password.length < 8) {
            return 'Password must be at least 8 characters';
        }
        return null;
    };

    const validateDisplayName = (displayName: string): string | null => {
        if (!displayName) {
            return 'Display name is required';
        }
        if (displayName.length < 2) {
            return 'Display name must be at least 2 characters';
        }
        if (displayName.length > 50) {
            return 'Display name must be less than 50 characters';
        }
        return null;
    };

    const validateHandle = (handle: string): string | null => {
        if (!handle) {
            return 'Handle is required';
        }
        // Ensure handle starts with @
        const handleToValidate = handle.startsWith('@') ? handle : `@${handle}`;
        
        if (handleToValidate.length < 2) {
            return 'Handle must be at least 1 character (plus @)';
        }
        if (handleToValidate.length > 30) {
            return 'Handle must be less than 30 characters';
        }
        // Check for valid characters (alphanumeric, underscore, hyphen)
        const handleRegex = /^@[a-zA-Z0-9_-]+$/;
        if (!handleRegex.test(handleToValidate)) {
            return 'Handle can only contain letters, numbers, underscores, and hyphens';
        }
        return null;
    };

    const validateProfilePicture = (profilePicture: string): string | null => {
        if (!profilePicture) {
            return 'Profile picture is required';
        }
        // Accept both URLs and local file URIs (file://, content://, etc.)
        if (profilePicture.startsWith('http://') || 
            profilePicture.startsWith('https://') ||
            profilePicture.startsWith('file://') ||
            profilePicture.startsWith('content://')) {
            return null;
        }
        return 'Please provide a valid profile picture';
    };

    const validateAll = (): boolean => {
        const errors: ValidationErrors = {};
        
        const emailError = validateEmail(onboardingData.email);
        if (emailError) errors.email = emailError;
        
        // Only validate password for email registration
        if (!onboardingData.appleId && !onboardingData.googleId) {
            const passwordError = validatePassword(onboardingData.password);
            if (passwordError) errors.password = passwordError;
        }
        
        const displayNameError = validateDisplayName(onboardingData.displayName);
        if (displayNameError) errors.displayName = displayNameError;
        
        const handleError = validateHandle(onboardingData.handle);
        if (handleError) errors.handle = handleError;
        
        const profilePictureError = validateProfilePicture(onboardingData.profilePicture);
        if (profilePictureError) errors.profilePicture = profilePictureError;
        
        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    };

    // Update functions
    const updateEmail = (email: string) => {
        setOnboardingData(prev => ({ ...prev, email }));
        const error = validateEmail(email);
        setValidationErrors(prev => ({ ...prev, email: error || undefined }));
    };

    const updatePassword = (password: string) => {
        setOnboardingData(prev => ({ ...prev, password }));
        const error = validatePassword(password);
        setValidationErrors(prev => ({ ...prev, password: error || undefined }));
    };

    const updateDisplayName = (displayName: string) => {
        setOnboardingData(prev => ({ ...prev, displayName }));
        const error = validateDisplayName(displayName);
        setValidationErrors(prev => ({ ...prev, displayName: error || undefined }));
    };

    const updateHandle = (handle: string) => {
        // Ensure handle starts with @
        const formattedHandle = handle.startsWith('@') ? handle : `@${handle}`;
        setOnboardingData(prev => ({ ...prev, handle: formattedHandle }));
        const error = validateHandle(formattedHandle);
        setValidationErrors(prev => ({ ...prev, handle: error || undefined }));
    };

    const updateProfilePicture = (profilePicture: string) => {
        setOnboardingData(prev => ({ ...prev, profilePicture }));
        const error = validateProfilePicture(profilePicture);
        setValidationErrors(prev => ({ ...prev, profilePicture: error || undefined }));
    };

    const updateAppleId = (appleId: string) => {
        setOnboardingData(prev => ({ ...prev, appleId }));
    };

    const updateGoogleId = (googleId: string) => {
        setOnboardingData(prev => ({ ...prev, googleId }));
    };

    const updateOnboardingData = (data: Partial<OnboardingData>) => {
        setOnboardingData(prev => ({ ...prev, ...data }));
    };

    // Registration functions
    const registerWithEmail = async (profilePictureUrl?: string) => {
        // Use provided URL or fall back to state
        const profilePic = profilePictureUrl || onboardingData.profilePicture;
        
        if (!profilePic) {
            throw new Error('Profile picture is required. Please select an image first.');
        }
        
        // Validate required fields (email is optional, profile picture passed as param)
        const errors: ValidationErrors = {};
        
        // Email is optional, only validate if provided
        if (onboardingData.email) {
            const emailError = validateEmail(onboardingData.email);
            if (emailError) errors.email = emailError;
        }
        
        const passwordError = validatePassword(onboardingData.password);
        if (passwordError) errors.password = passwordError;
        
        const displayNameError = validateDisplayName(onboardingData.displayName);
        if (displayNameError) errors.displayName = displayNameError;
        
        const handleError = validateHandle(onboardingData.handle);
        if (handleError) errors.handle = handleError;
        
        // Only validate profile picture from state if not provided as parameter
        if (!profilePictureUrl) {
            const profilePictureError = validateProfilePicture(onboardingData.profilePicture);
            if (profilePictureError) errors.profilePicture = profilePictureError;
        }
        
        if (Object.keys(errors).length > 0) {
            console.error('Validation errors:', errors);
            throw new Error('Validation failed. Please check all fields.');
        }

        setIsLoading(true);
        try {
            console.log('Registering with data:', {
                email: onboardingData.email,
                phone: onboardingData.phone,
                display_name: onboardingData.displayName,
                handle: onboardingData.handle,
                profile_picture: profilePic,
            });
            
            // Use client.POST directly so we can access response headers
            const result = await client.POST("/v1/auth/register", {
                body: {
                    email: onboardingData.email || "",
                    phone: onboardingData.phone || "",
                    password: onboardingData.password,
                    display_name: onboardingData.displayName,
                    handle: onboardingData.handle,
                    profile_picture: profilePic,
                }
            });
            
            if (result.error) {
                console.error('❌ Registration failed:', result.error);
                throw new Error('Registration failed');
            }
            
            console.log('✅ Registration successful!');
            
            // Registration now returns the full user data in the response body!
            // No need for a separate login call
            const userData = result.data as any;
            setUser(userData);
            
            console.log('✅ User registered and logged in!');
            console.log('👤 User ID:', userData._id);
            console.log('👤 User display name:', userData.display_name);
            
            // Note: Default workspace is created automatically by the backend during registration
            // No need to call setupDefaultWorkspace() here
            
            // Reset after successful registration and login
            console.log('🧹 Resetting onboarding state...');
            reset();
            console.log('✅ Registration flow complete!');
        } catch (error: any) {
            console.error('Email registration failed:', error);
            
            // Extract error message from backend response
            let errorMessage = 'Registration failed. Please try again.';
            
            // openapi-fetch returns errors in a specific format
            if (error?.message) {
                errorMessage = error.message;
            } else if (error?.error?.message) {
                errorMessage = error.error.message;
            } else if (error?.detail) {
                errorMessage = error.detail;
            } else if (typeof error === 'string') {
                errorMessage = error;
            }
            
            console.error('❌ Registration error message:', errorMessage);
            
            // Throw error with the backend message so the UI can display it
            throw new Error(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const registerWithApple = async (profilePictureUrl?: string) => {
        // Use provided URL or fall back to state
        const profilePic = profilePictureUrl || onboardingData.profilePicture;
        
        if (!profilePic) {
            throw new Error('Profile picture is required. Please select an image first.');
        }
        
        if (!onboardingData.appleId) {
            throw new Error('Apple ID is required');
        }
        
        // Validate required fields for Apple registration
        const errors: ValidationErrors = {};
        
        const displayNameError = validateDisplayName(onboardingData.displayName);
        if (displayNameError) errors.displayName = displayNameError;
        
        const handleError = validateHandle(onboardingData.handle);
        if (handleError) errors.handle = handleError;
        
        // Email is required for Apple
        const emailError = validateEmail(onboardingData.email);
        if (emailError) errors.email = emailError;
        
        if (Object.keys(errors).length > 0) {
            console.error('Validation errors:', errors);
            throw new Error('Validation failed. Please check all fields.');
        }

        setIsLoading(true);
        try {
            console.log('DEBUG - Full onboardingData:', onboardingData);
            console.log('DEBUG - Email value:', onboardingData.email);
            console.log('DEBUG - Email type:', typeof onboardingData.email);
            console.log('Registering with Apple data:', {
                apple_id: onboardingData.appleId,
                email: onboardingData.email,
                display_name: onboardingData.displayName,
                handle: onboardingData.handle,
                profile_picture: profilePic,
            });
            
            // Use client.POST directly so we can access response headers
            const result = await client.POST("/v1/auth/register/apple", {
                body: {
                    apple_id: onboardingData.appleId,
                    email: onboardingData.email,
                    display_name: onboardingData.displayName,
                    handle: onboardingData.handle,
                    profile_picture: profilePic,
                }
            });
            
            if (result.error) {
                console.error('❌ Apple registration failed:', result.error);
                throw new Error('Apple registration failed');
            }
            
            console.log('✅ Apple registration successful!');
            
            // Registration now returns the full user data in the response body!
            // No need for a separate login call
            const userData = result.data as any;
            setUser(userData);
            
            console.log('✅ User registered and logged in!');
            console.log('👤 User ID:', userData._id);
            console.log('👤 User display name:', userData.display_name);
            
            // Note: Default workspace is created automatically by the backend during registration
            // No need to call setupDefaultWorkspace() here
            
            // Reset after successful registration and login
            console.log('🧹 Resetting onboarding state...');
            reset();
            console.log('✅ Registration flow complete!');
        } catch (error: any) {
            console.error('Apple registration failed:', error);
            
            // Extract error message from backend response
            let errorMessage = 'Apple registration failed. Please try again.';
            
            // openapi-fetch returns errors in a specific format
            if (error?.message) {
                errorMessage = error.message;
            } else if (error?.error?.message) {
                errorMessage = error.error.message;
            } else if (error?.detail) {
                errorMessage = error.detail;
            } else if (typeof error === 'string') {
                errorMessage = error;
            }
            
            console.error('❌ Apple registration error message:', errorMessage);
            
            // Throw error with the backend message so the UI can display it
            throw new Error(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const registerWithGoogle = async () => {
        if (!onboardingData.googleId) {
            throw new Error('Google ID is required');
        }
        
        if (!validateAll()) {
            throw new Error('Validation failed. Please check all fields.');
        }

        setIsLoading(true);
        try {
            await authRegisterWithGoogle(onboardingData.email, onboardingData.googleId);
            
            // Also send the profile data
            await googleRegisterMutation.mutateAsync({
                body: {
                    google_id: onboardingData.googleId,
                    email: onboardingData.email,
                    display_name: onboardingData.displayName,
                    handle: onboardingData.handle,
                    profile_picture: onboardingData.profilePicture,
                }
            });
            
            // Note: Default workspace is created automatically by the backend during registration
            // No need to call setupDefaultWorkspace() here
            
            reset();
        } catch (error) {
            console.error('Google registration failed:', error);
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    const reset = () => {
        setOnboardingData(initialData);
        setValidationErrors({});
        setIsLoading(false);
    };

    const value: OnboardingContextType = {
        onboardingData,
        validationErrors,
        isLoading,
        updateEmail,
        updatePassword,
        updateDisplayName,
        updateHandle,
        updateProfilePicture,
        updateAppleId,
        updateGoogleId,
        updateOnboardingData,
        validateEmail,
        validatePassword,
        validateDisplayName,
        validateHandle,
        validateProfilePicture,
        validateAll,
        registerWithEmail,
        registerWithApple,
        registerWithGoogle,
        reset,
    };

    return (
        <OnboardingContext.Provider value={value}>
            {children}
        </OnboardingContext.Provider>
    );
}

export function useOnboarding() {
    const context = useContext(OnboardingContext);
    if (context === undefined) {
        throw new Error('useOnboarding must be used within an OnboardingProvider');
    }
    return context;
}
