/**
 * Fingerprint/Biometric Authentication Utilities using WebAuthn API
 * 
 * This module provides functions for registering and authenticating 
 * fingerprint biometrics using the Web Authentication API (WebAuthn).
 * Works with fingerprint sensors on mobile devices and biometric readers.
 */

// Buffer conversions for WebAuthn
function bufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function base64ToBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

export interface FingerprintCredential {
    id: string;
    publicKey: string;
    signCount: number;
    transports?: string[];
}

export interface RegistrationResult {
    success: boolean;
    credential?: FingerprintCredential;
    error?: string;
}

export interface VerificationResult {
    success: boolean;
    error?: string;
}

export interface BiometricStatus {
    available: boolean;
    type: 'fingerprint' | 'face' | 'none';
    supportedTypes: string[];
}

/**
 * Check if biometric authentication is available on the device
 */
export async function checkBiometricAvailability(): Promise<BiometricStatus> {
    const result: BiometricStatus = {
        available: false,
        type: 'none',
        supportedTypes: []
    };

    // Check if WebAuthn is supported
    if (!window.PublicKeyCredential) {
        return result;
    }

    result.available = true;

    // Check for available authentication methods
    try {
        // Check if platform authenticator is available (fingerprint/face on device)
        const platformAvailable = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();

        if (platformAvailable) {
            result.supportedTypes.push('platform');

            // Try to determine specific type based on device
            const ua = navigator.userAgent.toLowerCase();
            if (ua.includes('android')) {
                result.type = 'fingerprint';
                result.supportedTypes.push('fingerprint');
            } else if (ua.includes('iphone') || ua.includes('ipad')) {
                // iOS devices with Face ID or Touch ID
                result.supportedTypes.push('fingerprint', 'face');
                result.type = 'face'; // Default to face for newer iOS
            } else {
                result.type = 'fingerprint';
                result.supportedTypes.push('fingerprint');
            }
        }
    } catch {
        // Platform authenticator not available
    }

    return result;
}

/**
 * Generate a random challenge for WebAuthn
 */
function generateChallenge(): ArrayBuffer {
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);
    return challenge.buffer as ArrayBuffer;
}

/**
 * Generate a random user ID
 */
function generateUserId(): ArrayBuffer {
    const userId = new Uint8Array(16);
    crypto.getRandomValues(userId);
    return userId.buffer as ArrayBuffer;
}

/**
 * Register a new fingerprint credential
 */
export async function registerFingerprint(
    userEmail: string,
    userName: string
): Promise<RegistrationResult> {
    try {
        // Check availability first
        const status = await checkBiometricAvailability();
        if (!status.available) {
            return {
                success: false,
                error: 'Biometric authentication is not supported on this device'
            };
        }

        const challenge = generateChallenge();
        const userId = generateUserId();

        const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
            challenge,
            rp: {
                name: 'Vidula Voting System',
                id: window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname
            },
            user: {
                id: userId,
                name: userEmail,
                displayName: userName
            },
            pubKeyCredParams: [
                { alg: -7, type: 'public-key' },   // ES256
                { alg: -257, type: 'public-key' }  // RS256
            ],
            authenticatorSelection: {
                authenticatorAttachment: 'platform',
                userVerification: 'required'
            },
            timeout: 60000,
            attestation: 'direct'
        };

        const credential = await navigator.credentials.create({
            publicKey: publicKeyCredentialCreationOptions
        }) as PublicKeyCredential;

        if (!credential) {
            return {
                success: false,
                error: 'Failed to create credential'
            };
        }

        const response = credential.response as AuthenticatorAttestationResponse;

        // Extract credential data
        const credentialData: FingerprintCredential = {
            id: credential.id,
            publicKey: bufferToBase64(response.attestationObject),
            signCount: response.getAuthenticatorData ?
                new DataView(response.getAuthenticatorData()).getUint32(33, false) : 0,
            transports: response.getTransports ? response.getTransports() : []
        };

        // Store credential ID for later verification
        localStorage.setItem('fingerprint_credential_id', credential.id);

        return {
            success: true,
            credential: credentialData
        };
    } catch (error) {
        console.error('Fingerprint registration error:', error);

        let errorMessage = 'Registration failed';
        if (error instanceof Error) {
            if (error.name === 'NotAllowedError') {
                errorMessage = 'Biometric authentication was cancelled or not allowed';
            } else if (error.name === 'NotSupportedError') {
                errorMessage = 'Biometric authentication is not supported';
            } else if (error.name === 'InvalidStateError') {
                errorMessage = 'A credential for this user already exists';
            } else {
                errorMessage = error.message;
            }
        }

        return {
            success: false,
            error: errorMessage
        };
    }
}

/**
 * Verify fingerprint for authentication
 */
export async function verifyFingerprint(
    storedCredentialId: string
): Promise<VerificationResult & { assertionData?: string }> {
    try {
        // Check availability
        const status = await checkBiometricAvailability();
        if (!status.available) {
            return {
                success: false,
                error: 'Biometric authentication is not supported on this device'
            };
        }

        const challenge = generateChallenge();

        const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
            challenge,
            allowCredentials: [{
                id: base64ToBuffer(storedCredentialId),
                type: 'public-key',
                transports: ['internal']
            }],
            userVerification: 'required',
            timeout: 60000
        };

        const assertion = await navigator.credentials.get({
            publicKey: publicKeyCredentialRequestOptions
        }) as PublicKeyCredential;

        if (!assertion) {
            return {
                success: false,
                error: 'Authentication failed - no assertion returned'
            };
        }

        const response = assertion.response as AuthenticatorAssertionResponse;

        // Create assertion data for server verification
        const assertionData = JSON.stringify({
            id: assertion.id,
            rawId: bufferToBase64(assertion.rawId),
            response: {
                authenticatorData: bufferToBase64(response.authenticatorData),
                clientDataJSON: bufferToBase64(response.clientDataJSON),
                signature: bufferToBase64(response.signature),
                userHandle: response.userHandle ? bufferToBase64(response.userHandle) : null
            },
            type: assertion.type
        });

        return {
            success: true,
            assertionData
        };
    } catch (error) {
        console.error('Fingerprint verification error:', error);

        let errorMessage = 'Verification failed';
        if (error instanceof Error) {
            if (error.name === 'NotAllowedError') {
                errorMessage = 'Biometric authentication was cancelled or failed';
            } else if (error.name === 'NotSupportedError') {
                errorMessage = 'Biometric authentication is not supported';
            } else {
                errorMessage = error.message;
            }
        }

        return {
            success: false,
            error: errorMessage
        };
    }
}

/**
 * Hook for using fingerprint authentication in React components
 */
import { useState, useCallback, useEffect } from 'react';

export interface FingerprintState {
    status: 'idle' | 'registering' | 'verifying' | 'success' | 'error';
    available: boolean;
    biometricType: 'fingerprint' | 'face' | 'none';
    error: string | null;
    credentialId: string | null;
}

export function useFingerprint() {
    const [state, setState] = useState<FingerprintState>({
        status: 'idle',
        available: false,
        biometricType: 'none',
        error: null,
        credentialId: null
    });

    // Check availability on mount
    useEffect(() => {
        checkBiometricAvailability().then((status) => {
            setState(prev => ({
                ...prev,
                available: status.available,
                biometricType: status.type
            }));
        });
    }, []);

    // Load stored credential ID
    useEffect(() => {
        const storedId = localStorage.getItem('fingerprint_credential_id');
        if (storedId) {
            setState(prev => ({
                ...prev,
                credentialId: storedId
            }));
        }
    }, []);

    const register = useCallback(async (userEmail: string, userName: string) => {
        setState(prev => ({ ...prev, status: 'registering', error: null }));

        const result = await registerFingerprint(userEmail, userName);

        if (result.success && result.credential) {
            setState(prev => ({
                ...prev,
                status: 'success',
                credentialId: result.credential!.id
            }));
        } else {
            setState(prev => ({
                ...prev,
                status: 'error',
                error: result.error || 'Registration failed'
            }));
        }

        return result;
    }, []);

    const verify = useCallback(async (credentialId?: string) => {
        const idToUse = credentialId || state.credentialId;

        if (!idToUse) {
            setState(prev => ({
                ...prev,
                status: 'error',
                error: 'No credential ID available'
            }));
            return { success: false, error: 'No credential ID available' };
        }

        setState(prev => ({ ...prev, status: 'verifying', error: null }));

        const result = await verifyFingerprint(idToUse);

        if (result.success) {
            setState(prev => ({ ...prev, status: 'success' }));
        } else {
            setState(prev => ({
                ...prev,
                status: 'error',
                error: result.error || 'Verification failed'
            }));
        }

        return result;
    }, [state.credentialId]);

    const reset = useCallback(() => {
        setState(prev => ({
            ...prev,
            status: 'idle',
            error: null
        }));
    }, []);

    return {
        ...state,
        register,
        verify,
        reset
    };
}
