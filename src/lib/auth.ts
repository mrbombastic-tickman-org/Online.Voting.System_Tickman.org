import { cookies } from 'next/headers';
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';
import prisma from './prisma';

// Secure session management with encryption and HMAC
export interface SessionData {
    userId: string;
    email: string;
    fullName: string;
    verified: boolean;
    isAdmin: boolean;
    sessionId: string;
    createdAt: number;
}

const SESSION_COOKIE = 'voting-session';
const CSRF_COOKIE = 'csrf-token';

// Use environment variables for secrets (must be 32 bytes for AES-256)
const getEncryptionKey = (): Buffer => {
    const key = process.env.SESSION_SECRET_KEY;
    if (!key) {
        throw new Error('SESSION_SECRET_KEY environment variable is required');
    }
    // Derive a 32-byte key from the secret using SHA-256
    return createHash('sha256').update(key).digest();
};

// Encrypt session data with AES-256-GCM (authenticated encryption)
export async function createSessionToken(data: SessionData): Promise<string> {
    const key = getEncryptionKey();
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-gcm', key, iv);

    // Generate unique session ID and store in database
    const sessionId = generateSessionId();

    // Store session in database for invalidation capability
    await prisma.session.create({
        data: {
            token: sessionId,
            userId: data.userId,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        },
    });

    const plaintext = JSON.stringify({
        ...data,
        sessionId,
        createdAt: Date.now(),
    });

    const encrypted = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    // Format: iv:authTag:encrypted (all hex-encoded)
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

// Decrypt and verify session token
export async function parseSessionToken(token: string): Promise<SessionData | null> {
    try {
        const parts = token.split(':');
        if (parts.length !== 3) return null;

        const [ivHex, authTagHex, encryptedHex] = parts;
        const key = getEncryptionKey();
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');
        const encrypted = Buffer.from(encryptedHex, 'hex');

        const decipher = createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(authTag);

        const decrypted = Buffer.concat([
            decipher.update(encrypted),
            decipher.final(),
        ]);

        const data = JSON.parse(decrypted.toString('utf8')) as SessionData;

        // Validate session age (max 24 hours)
        const sessionAge = Date.now() - (data.createdAt || 0);
        if (sessionAge > 24 * 60 * 60 * 1000) {
            return null;
        }

        // Validate session exists in database (not revoked)
        const dbSession = await prisma.session.findUnique({
            where: { token: data.sessionId },
        });

        if (!dbSession) {
            return null; // Session was revoked or doesn't exist
        }

        if (dbSession.expiresAt < new Date()) {
            // Clean up expired session
            await prisma.session.delete({ where: { token: data.sessionId } });
            return null;
        }

        return data;
    } catch {
        // Decryption failed - token was tampered with or invalid
        return null;
    }
}

export async function getSession(): Promise<SessionData | null> {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    // parseSessionToken already validates age + DB session existence
    return await parseSessionToken(token);
}

export async function isAdmin(): Promise<boolean> {
    const session = await getSession();
    return session?.isAdmin === true;
}

export async function setSessionCookie(data: SessionData) {
    const cookieStore = await cookies();
    const token = await createSessionToken(data); // await — it writes to DB

    cookieStore.set(SESSION_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 24,
        path: '/',
    });

    // CSRF double-submit cookie (readable by JS to set header)
    const csrfToken = randomBytes(32).toString('hex');
    cookieStore.set(CSRF_COOKIE, csrfToken, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 24,
        path: '/',
    });
}

export async function clearSession() {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;

    // Revoke session in DB so the token is invalid even if somehow replayed
    if (token) {
        try {
            const parsed = await parseSessionToken(token);
            if (parsed?.sessionId) {
                await prisma.session.deleteMany({ where: { token: parsed.sessionId } });
            }
        } catch {
            // Ignore errors during logout cleanup
        }
    }

    cookieStore.delete(SESSION_COOKIE);
    cookieStore.delete(CSRF_COOKIE);
}

// Get CSRF token from cookies for verification
export async function getCSRFToken(): Promise<string | null> {
    const cookieStore = await cookies();
    return cookieStore.get(CSRF_COOKIE)?.value || null;
}

// Verify CSRF token from request headers against cookie
export async function verifyCSRF(request: Request): Promise<boolean> {
    const cookieToken = await getCSRFToken();
    const headerToken = request.headers.get('x-csrf-token');
    if (!cookieToken || !headerToken) return false;
    // Constant-time comparison to prevent timing attacks
    return timingSafeEqual(cookieToken, headerToken);
}

// Constant-time string comparison to prevent timing attacks
function timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let result = 0;
    for (let i = 0; i < a.length; i++) {
        result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
}

// Rate limiting store (in-memory for demo - use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export interface RateLimitConfig {
    windowMs: number;  // Time window in milliseconds
    maxRequests: number; // Max requests per window
    message?: string;
}

export function checkRateLimit(
    identifier: string,
    config: RateLimitConfig
): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now();
    const entry = rateLimitStore.get(identifier);

    if (!entry || now > entry.resetTime) {
        // New window
        rateLimitStore.set(identifier, {
            count: 1,
            resetTime: now + config.windowMs,
        });
        return { allowed: true, remaining: config.maxRequests - 1, resetTime: now + config.windowMs };
    }

    if (entry.count >= config.maxRequests) {
        return { allowed: false, remaining: 0, resetTime: entry.resetTime };
    }

    entry.count++;
    return { allowed: true, remaining: config.maxRequests - entry.count, resetTime: entry.resetTime };
}

// Clean up expired rate limit entries periodically
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
        if (now > entry.resetTime) {
            rateLimitStore.delete(key);
        }
    }
}, 60000); // Clean every minute

// Get client IP with trusted proxy support and safe fallback behavior.
export function getClientIP(request: Request): string {
    const trustedProxies = (process.env.TRUSTED_PROXIES || '')
        .split(',')
        .map((ip) => ip.trim())
        .filter(Boolean);

    const forwardedFor = firstForwardedIP(request.headers.get('x-forwarded-for'));
    const realIP = normalizeIP(request.headers.get('x-real-ip'));
    const vendorIP = normalizeIP(
        request.headers.get('cf-connecting-ip') ||
        request.headers.get('true-client-ip') ||
        request.headers.get('x-vercel-forwarded-for') ||
        request.headers.get('fly-client-ip')
    );

    // If trusted proxies are configured, prefer proxy-forwarded headers.
    if (trustedProxies.length > 0) {
        return forwardedFor || realIP || vendorIP || 'unknown';
    }

    // Without explicit proxy trust config, still use best-effort client IP
    // to avoid collapsing all rate limits under "unknown".
    return forwardedFor || realIP || vendorIP || 'unknown';
}

export function getRateLimitIdentifier(request: Request, scope: string): string {
    const ip = getClientIP(request);
    if (ip !== 'unknown') {
        return `${scope}:ip:${ip}`;
    }

    // Fallback identifier if no IP data is available.
    const ua = request.headers.get('user-agent') || 'unknown';
    const lang = request.headers.get('accept-language') || '';
    const fingerprint = createHash('sha256')
        .update(`${ua}|${lang}`)
        .digest('hex')
        .slice(0, 16);
    return `${scope}:fp:${fingerprint}`;
}

function firstForwardedIP(value: string | null): string | null {
    if (!value) return null;
    const first = value.split(',')[0]?.trim() || '';
    return normalizeIP(first);
}

function normalizeIP(value: string | null): string | null {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;

    if (trimmed.startsWith('[') && trimmed.includes(']')) {
        return trimmed.slice(1, trimmed.indexOf(']'));
    }

    if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(trimmed)) {
        return trimmed.split(':')[0];
    }

    return trimmed;
}

// Generate a secure session ID for database storage
export function generateSessionId(): string {
    return randomBytes(32).toString('hex');
}
