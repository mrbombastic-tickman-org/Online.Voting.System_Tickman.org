import { createHash, createPublicKey, timingSafeEqual, verify as cryptoVerify } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession, verifyCSRF } from '@/lib/auth';
import {
    issueFingerprintChallenge,
    consumeFingerprintChallenge,
    markFingerprintVerified,
} from '@/lib/fingerprint-session';

interface AssertionPayload {
    id: string;
    rawId: string;
    type: string;
    response: {
        authenticatorData: string;
        clientDataJSON: string;
        signature: string;
        userHandle: string | null;
    };
}

interface ClientDataPayload {
    type: string;
    challenge: string;
    origin: string;
}

const DEV_ALLOWED_ORIGINS = new Set([
    'http://localhost:3000',
    'https://localhost:3000',
]);

/**
 * Verify fingerprint authentication for voting
 * POST /api/verify-fingerprint
 */
export async function POST(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json(
                { error: 'Not authenticated' },
                { status: 401 }
            );
        }

        if (!(await verifyCSRF(request))) {
            return NextResponse.json(
                { error: 'CSRF validation failed' },
                { status: 403 }
            );
        }

        const body = await request.json();
        const { assertionData } = body as { assertionData?: string | AssertionPayload };

        if (!assertionData) {
            return NextResponse.json(
                { error: 'Assertion data is required' },
                { status: 400 }
            );
        }

        const user = await prisma.user.findUnique({
            where: { id: session.userId },
            select: {
                fingerprintCredential: true,
                fingerprintPublicKey: true,
            },
        });

        if (!user) {
            return NextResponse.json(
                { error: 'User not found' },
                { status: 404 }
            );
        }

        if (!user.fingerprintCredential || !user.fingerprintPublicKey) {
            return NextResponse.json(
                { error: 'No fingerprint public key registered for this user' },
                { status: 400 }
            );
        }

        const assertion = parseAssertion(assertionData);
        if (!assertion) {
            return NextResponse.json(
                { error: 'Invalid assertion payload' },
                { status: 400 }
            );
        }

        let clientDataJSON = '';
        try {
            clientDataJSON = base64UrlToBuffer(assertion.response.clientDataJSON).toString('utf8');
        } catch {
            return NextResponse.json(
                { error: 'Invalid clientDataJSON encoding' },
                { status: 400 }
            );
        }
        const clientData = parseClientData(clientDataJSON);
        if (!clientData) {
            return NextResponse.json(
                { error: 'Invalid clientDataJSON' },
                { status: 400 }
            );
        }

        if (clientData.type !== 'webauthn.get') {
            return NextResponse.json(
                { error: 'Unexpected WebAuthn operation type' },
                { status: 400 }
            );
        }

        if (!isAllowedOrigin(clientData.origin, request)) {
            return NextResponse.json(
                { error: 'Origin mismatch during fingerprint verification' },
                { status: 403 }
            );
        }

        if (!consumeFingerprintChallenge(session.userId, clientData.challenge)) {
            return NextResponse.json(
                { verified: false, error: 'Fingerprint challenge expired or invalid', message: 'Fingerprint challenge expired or invalid' },
                { status: 400 }
            );
        }

        if (!isCredentialMatch(assertion, user.fingerprintCredential)) {
            return NextResponse.json(
                { verified: false, error: 'Credential mismatch', message: 'Credential mismatch' },
                { status: 403 }
            );
        }

        const authValidation = verifyAuthenticatorData(assertion, clientData.origin);
        if (!authValidation.ok) {
            return NextResponse.json(
                { verified: false, error: authValidation.reason, message: authValidation.reason },
                { status: 403 }
            );
        }

        const signatureVerified = await verifySignature(
            assertion,
            user.fingerprintPublicKey
        );

        if (!signatureVerified) {
            return NextResponse.json(
                { verified: false, error: 'Fingerprint signature verification failed', message: 'Fingerprint signature verification failed' },
                { status: 403 }
            );
        }

        markFingerprintVerified(session.userId);

        return NextResponse.json({
            verified: true,
            message: 'Fingerprint verified successfully',
        });

    } catch (error) {
        console.error('Fingerprint verification error:', error);
        return NextResponse.json(
            { error: 'Verification failed' },
            { status: 500 }
        );
    }
}

/**
 * Check if fingerprint is available for user
 * GET /api/verify-fingerprint
 */
export async function GET(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json(
                { error: 'Not authenticated' },
                { status: 401 }
            );
        }

        const mode = request.nextUrl.searchParams.get('mode');

        const user = await prisma.user.findUnique({
            where: { id: session.userId },
            select: {
                fingerprintCredential: true,
                biometricType: true,
            },
        });

        if (mode === 'challenge') {
            if (!user?.fingerprintCredential) {
                return NextResponse.json(
                    { error: 'No fingerprint registered for this user' },
                    { status: 400 }
                );
            }

            return NextResponse.json({
                hasFingerprint: true,
                biometricType: user.biometricType || 'face',
                credentialId: user.fingerprintCredential,
                challenge: issueFingerprintChallenge(session.userId),
            });
        }

        return NextResponse.json({
            hasFingerprint: !!user?.fingerprintCredential,
            biometricType: user?.biometricType || 'face',
        });

    } catch (error) {
        console.error('Error checking fingerprint:', error);
        return NextResponse.json(
            { error: 'Failed to check fingerprint status' },
            { status: 500 }
        );
    }
}

function parseAssertion(assertionData: string | AssertionPayload): AssertionPayload | null {
    try {
        const parsed = typeof assertionData === 'string'
            ? JSON.parse(assertionData)
            : assertionData;

        if (
            !parsed ||
            typeof parsed.id !== 'string' ||
            typeof parsed.rawId !== 'string' ||
            typeof parsed.type !== 'string' ||
            !parsed.response ||
            typeof parsed.response.authenticatorData !== 'string' ||
            typeof parsed.response.clientDataJSON !== 'string' ||
            typeof parsed.response.signature !== 'string'
        ) {
            return null;
        }

        return parsed;
    } catch {
        return null;
    }
}

function parseClientData(clientDataJSON: string): ClientDataPayload | null {
    try {
        const parsed = JSON.parse(clientDataJSON) as Partial<ClientDataPayload>;
        if (
            typeof parsed.type !== 'string' ||
            typeof parsed.challenge !== 'string' ||
            typeof parsed.origin !== 'string'
        ) {
            return null;
        }
        return parsed as ClientDataPayload;
    } catch {
        return null;
    }
}

function getAllowedOrigins(request: NextRequest): Set<string> {
    const origins = new Set<string>([new URL(request.url).origin]);
    if (process.env.APP_ORIGIN) {
        origins.add(process.env.APP_ORIGIN);
    }
    if (process.env.NODE_ENV !== 'production') {
        for (const origin of DEV_ALLOWED_ORIGINS) {
            origins.add(origin);
        }
    }
    return origins;
}

function isAllowedOrigin(origin: string, request: NextRequest): boolean {
    return getAllowedOrigins(request).has(origin);
}

function isCredentialMatch(assertion: AssertionPayload, storedCredential: string): boolean {
    const normalizedStored = normalizeBase64Url(storedCredential);
    return (
        normalizeBase64Url(assertion.rawId) === normalizedStored ||
        normalizeBase64Url(assertion.id) === normalizedStored ||
        assertion.id === storedCredential
    );
}

function verifyAuthenticatorData(assertion: AssertionPayload, origin: string): { ok: boolean; reason?: string } {
    let authenticatorData: Buffer;
    try {
        authenticatorData = base64UrlToBuffer(assertion.response.authenticatorData);
    } catch {
        return { ok: false, reason: 'Invalid authenticator data format' };
    }

    if (authenticatorData.length < 37) {
        return { ok: false, reason: 'Authenticator data is too short' };
    }

    const rpId = new URL(origin).hostname;
    const expectedRpIdHash = createHash('sha256').update(rpId).digest();
    const rpIdHash = authenticatorData.subarray(0, 32);

    if (
        rpIdHash.length !== expectedRpIdHash.length ||
        !timingSafeEqual(rpIdHash, expectedRpIdHash)
    ) {
        return {
            ok: false,
            reason: 'Fingerprint credential is bound to a different domain. Re-register on this site.',
        };
    }

    const flags = authenticatorData[32];
    const userPresent = (flags & 0x01) !== 0;
    const userVerified = (flags & 0x04) !== 0;
    if (!userPresent || !userVerified) {
        return { ok: false, reason: 'Biometric verification was not confirmed by authenticator' };
    }

    return { ok: true };
}

async function verifySignature(
    assertion: AssertionPayload,
    storedPublicKey: string
): Promise<boolean> {
    let publicKeyBuffer: Buffer;
    let authenticatorData: Buffer;
    let clientDataJSON: Buffer;
    let signature: Buffer;
    try {
        publicKeyBuffer = base64UrlToBuffer(storedPublicKey);
        authenticatorData = base64UrlToBuffer(assertion.response.authenticatorData);
        clientDataJSON = base64UrlToBuffer(assertion.response.clientDataJSON);
        signature = base64UrlToBuffer(assertion.response.signature);
    } catch {
        return false;
    }
    const clientDataHash = createHash('sha256').update(clientDataJSON).digest();
    const signedPayload = Buffer.concat([authenticatorData, clientDataHash]);

    try {
        const publicKey = createPublicKey({
            key: publicKeyBuffer,
            format: 'der',
            type: 'spki',
        });

        // Node's verifier supports both RSA and EC keys with the same API.
        return cryptoVerify('sha256', signedPayload, publicKey, signature);
    } catch {
        return false;
    }
}

function normalizeBase64Url(value: string): string {
    return value.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBuffer(value: string): Buffer {
    const normalized = normalizeBase64Url(value);
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}
