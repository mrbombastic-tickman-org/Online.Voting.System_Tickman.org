import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

const FACE_PROOF_TTL_MS = 2 * 60 * 1000;

interface FaceProofPayload {
    uid: string;
    exp: number;
    conf: number;
    thr: number;
    nonce: string;
}

interface FaceProofValidation {
    valid: boolean;
    payload?: FaceProofPayload;
}

function getSecret(): string {
    const secret = process.env.SESSION_SECRET_KEY;
    if (!secret) {
        throw new Error('SESSION_SECRET_KEY environment variable is required');
    }
    return secret;
}

function sign(encodedPayload: string): string {
    return createHmac('sha256', getSecret()).update(encodedPayload).digest('base64url');
}

function safeEqual(a: string, b: string): boolean {
    const aBuf = Buffer.from(a, 'utf8');
    const bBuf = Buffer.from(b, 'utf8');
    if (aBuf.length !== bBuf.length) {
        return false;
    }
    return timingSafeEqual(aBuf, bBuf);
}

export function issueFaceProof(userId: string, confidence: number, threshold: number): string {
    const payload: FaceProofPayload = {
        uid: userId,
        exp: Date.now() + FACE_PROOF_TTL_MS,
        conf: confidence,
        thr: threshold,
        nonce: randomBytes(8).toString('base64url'),
    };
    const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    const signature = sign(encodedPayload);
    return `${encodedPayload}.${signature}`;
}

export function verifyFaceProof(token: string, expectedUserId: string): FaceProofValidation {
    const [encodedPayload, signature] = token.split('.');
    if (!encodedPayload || !signature) {
        return { valid: false };
    }

    const expectedSignature = sign(encodedPayload);
    if (!safeEqual(signature, expectedSignature)) {
        return { valid: false };
    }

    try {
        const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as FaceProofPayload;
        if (payload.uid !== expectedUserId) {
            return { valid: false };
        }
        if (Date.now() > payload.exp) {
            return { valid: false };
        }
        return { valid: true, payload };
    } catch {
        return { valid: false };
    }
}

export const FACE_PROOF_TTL_SECONDS = Math.floor(FACE_PROOF_TTL_MS / 1000);
