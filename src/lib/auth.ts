import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';
import prisma from './prisma';

// Simple JWT-like session using cookies (demo purposes)
export interface SessionData {
    userId: string;
    email: string;
    fullName: string;
    verified: boolean;
}

const SESSION_COOKIE = 'voting-session';

export function createSessionToken(data: SessionData): string {
    // Base64 encode session data (demo only - use proper JWT in production)
    return Buffer.from(JSON.stringify(data)).toString('base64');
}

export function parseSessionToken(token: string): SessionData | null {
    try {
        return JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));
    } catch {
        return null;
    }
}

export async function getSession(): Promise<SessionData | null> {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    return parseSessionToken(token);
}

export async function setSessionCookie(data: SessionData) {
    const cookieStore = await cookies();
    const token = createSessionToken(data);
    cookieStore.set(SESSION_COOKIE, token, {
        httpOnly: true,
        secure: false, // dev
        sameSite: 'lax',
        maxAge: 60 * 60 * 24, // 1 day
        path: '/',
    });
}

export async function clearSession() {
    const cookieStore = await cookies();
    cookieStore.delete(SESSION_COOKIE);
}

export function getClientIP(request: Request): string {
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }
    const realIP = request.headers.get('x-real-ip');
    if (realIP) return realIP;
    return '127.0.0.1';
}
