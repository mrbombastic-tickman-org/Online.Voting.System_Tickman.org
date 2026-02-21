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
    return btoa(binary)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

function base64ToBuffer(base64: string): ArrayBuffer {
    const base64Standard = base64.replace(/-/g, '+').replace(/_/g, '/');
    const padLen = (4 - (base64Standard.length % 4)) % 4;
    const padded = base64Standard + '='.repeat(padLen);

    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

export interface FingerprintCredential {
    id: string;
    rawId: string;
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
        const publicKey = response.getPublicKey?.();

        if (!publicKey) {
            return {
                success: false,
                error: 'Browser does not expose WebAuthn public key. Please use Face verification on this device.',
            };
        }

        // Extract credential data
        const credentialData: FingerprintCredential = {
            id: credential.id,
            rawId: bufferToBase64(credential.rawId),
            publicKey: bufferToBase64(publicKey),
            signCount: response.getAuthenticatorData ?
                new DataView(response.getAuthenticatorData()).getUint32(33, false) : 0,
            transports: response.getTransports ? response.getTransports() : []
        };

        // Store raw credential ID for later verification.
        localStorage.setItem('fingerprint_credential_id', credentialData.rawId);

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
    challenge: string,
    storedCredentialId?: string
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

        const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
            challenge: base64ToBuffer(challenge),
            userVerification: 'required',
            timeout: 60000
        };

        if (storedCredentialId) {
            const credentialBuffer = safeBase64ToBuffer(storedCredentialId);
            if (credentialBuffer) {
                publicKeyCredentialRequestOptions.allowCredentials = [{
                    id: credentialBuffer,
                    type: 'public-key',
                    transports: ['internal']
                }];
            }
        }

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
    const [state, setState] = useState<FingerprintState>(() => {
        const storedId = typeof window !== 'undefined'
            ? localStorage.getItem('fingerprint_credential_id')
            : null;

        return {
            status: 'idle',
            available: false,
            biometricType: 'none',
            error: null,
            credentialId: storedId
        };
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

    const register = useCallback(async (userEmail: string, userName: string) => {
        setState(prev => ({ ...prev, status: 'registering', error: null }));

        const result = await registerFingerprint(userEmail, userName);

        if (result.success && result.credential) {
            setState(prev => ({
                ...prev,
                status: 'success',
                credentialId: result.credential!.rawId
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

    const verify = useCallback(async (challenge: string, credentialId?: string) => {
        if (!challenge) {
            setState(prev => ({
                ...prev,
                status: 'error',
                error: 'No challenge available'
            }));
            return { success: false, error: 'No challenge available' };
        }

        const idToUse = credentialId || state.credentialId || undefined;
        setState(prev => ({ ...prev, status: 'verifying', error: null }));

        const result = await verifyFingerprint(challenge, idToUse);

        if (result.success) {
            setState(prev => ({
                ...prev,
                status: 'success',
                credentialId: idToUse || prev.credentialId,
            }));
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

function safeBase64ToBuffer(value: string): ArrayBuffer | null {
    try {
        return base64ToBuffer(value);
    } catch {
        return null;
    }
}
