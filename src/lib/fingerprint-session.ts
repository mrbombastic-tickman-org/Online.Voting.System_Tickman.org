import { randomBytes, timingSafeEqual } from 'crypto';

interface ChallengeEntry {
    challenge: string;
    expiresAt: number;
}

interface VerificationEntry {
    expiresAt: number;
}

const CHALLENGE_TTL_MS = 2 * 60 * 1000;
const VERIFICATION_TTL_MS = 2 * 60 * 1000;

const challengeStore = new Map<string, ChallengeEntry>();
const verificationStore = new Map<string, VerificationEntry>();

export function issueFingerprintChallenge(userId: string): string {
    const challenge = randomBytes(32).toString('base64url');
    challengeStore.set(userId, {
        challenge,
        expiresAt: Date.now() + CHALLENGE_TTL_MS,
    });
    return challenge;
}

export function consumeFingerprintChallenge(userId: string, challenge: string): boolean {
    const entry = challengeStore.get(userId);
    if (!entry || Date.now() > entry.expiresAt) {
        challengeStore.delete(userId);
        return false;
    }

    challengeStore.delete(userId);
    return safeStringEqual(entry.challenge, normalizeBase64Url(challenge));
}

export function markFingerprintVerified(userId: string): void {
    verificationStore.set(userId, {
        expiresAt: Date.now() + VERIFICATION_TTL_MS,
    });
}

export function consumeFingerprintVerification(userId: string): boolean {
    const entry = verificationStore.get(userId);
    if (!entry || Date.now() > entry.expiresAt) {
        verificationStore.delete(userId);
        return false;
    }

    verificationStore.delete(userId);
    return true;
}

function normalizeBase64Url(value: string): string {
    return value.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function safeStringEqual(a: string, b: string): boolean {
    const aBuf = Buffer.from(a, 'utf8');
    const bBuf = Buffer.from(b, 'utf8');
    if (aBuf.length !== bBuf.length) {
        return false;
    }
    return timingSafeEqual(aBuf, bBuf);
}

// Clean up expired challenges/verification entries periodically.
setInterval(() => {
    const now = Date.now();

    for (const [userId, entry] of challengeStore.entries()) {
        if (now > entry.expiresAt) {
            challengeStore.delete(userId);
        }
    }

    for (const [userId, entry] of verificationStore.entries()) {
        if (now > entry.expiresAt) {
            verificationStore.delete(userId);
        }
    }
}, 60_000);
