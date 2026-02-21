import { NextRequest, NextResponse } from 'next/server';
import { compareSync } from 'bcryptjs';
import prisma from '@/lib/prisma';
import { setSessionCookie, checkRateLimit, getRateLimitIdentifier } from '@/lib/auth';

// Rate limit configuration: 50 attempts per minute per identifier
const LOGIN_RATE_LIMIT = {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 50,
    message: 'Too many login attempts. Please try again later.',
};

export async function POST(request: NextRequest) {
    try {
        // Rate limiting by IP
        const rateLimitKey = getRateLimitIdentifier(request, 'login');
        const rateLimit = checkRateLimit(rateLimitKey, LOGIN_RATE_LIMIT);

        if (!rateLimit.allowed) {
            return NextResponse.json(
                { error: LOGIN_RATE_LIMIT.message, retryAfter: Math.ceil((rateLimit.resetTime - Date.now()) / 1000) },
                { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.resetTime - Date.now()) / 1000)) } }
            );
        }

        const body = await request.json();
        const { email, password } = body;

        if (!email || !password) {
            return NextResponse.json(
                { error: 'Email and password are required' },
                { status: 400 }
            );
        }

        // Email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return NextResponse.json(
                { error: 'Invalid email format' },
                { status: 400 }
            );
        }

        const user = await prisma.user.findUnique({
            where: { email: email.toLowerCase().trim() },
        });

        // Use constant-time comparison and don't reveal if user exists
        const passwordMatch = user ? compareSync(password, user.passwordHash) : false;

        if (!user || !passwordMatch) {
            // Generic error message to prevent user enumeration
            return NextResponse.json(
                { error: 'Invalid email or password' },
                { status: 401 }
            );
        }

        await setSessionCookie({
            userId: user.id,
            email: user.email,
            fullName: user.fullName,
            verified: user.verified,
            isAdmin: user.isAdmin,
            sessionId: '', // will be overwritten inside createSessionToken
            createdAt: Date.now(),
        });

        return NextResponse.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                fullName: user.fullName,
                verified: user.verified,
            },
        });
    } catch (error: unknown) {
        // Don't leak error details to client
        console.error('Login error:', error);
        return NextResponse.json(
            { error: 'Login failed. Please try again.' },
            { status: 500 }
        );
    }
}
