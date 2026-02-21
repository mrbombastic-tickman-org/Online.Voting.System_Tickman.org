import { NextRequest, NextResponse } from 'next/server';
import { hashSync } from 'bcryptjs';
import prisma from '@/lib/prisma';
import { setSessionCookie, checkRateLimit, getRateLimitIdentifier } from '@/lib/auth';
import { facePlusPlus } from '@/lib/faceplusplus';

// Rate limit configuration: 50 registrations per minute per identifier
const REGISTER_RATE_LIMIT = {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 50,
    message: 'Too many registration attempts. Please try again later.',
};

// Password strength validation
function validatePassword(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Relaxed requirements for easier testing/use
    if (password.length < 6) {
        errors.push('Password must be at least 6 characters long');
    }

    // Check for common patterns
    const commonPatterns = ['password', '123456', 'qwerty', 'admin'];
    if (commonPatterns.some(p => password.toLowerCase().includes(p))) {
        errors.push('Password contains common patterns that are not allowed');
    }

    return { valid: errors.length === 0, errors };
}

function isLikelyBase64Url(value: string): boolean {
    return /^[A-Za-z0-9\-_]+$/.test(value) && value.length >= 16;
}

export async function POST(request: NextRequest) {
    try {
        // Rate limiting by IP
        const rateLimitKey = getRateLimitIdentifier(request, 'register');
        const rateLimit = checkRateLimit(rateLimitKey, REGISTER_RATE_LIMIT);

        if (!rateLimit.allowed) {
            return NextResponse.json(
                { error: REGISTER_RATE_LIMIT.message, retryAfter: Math.ceil((rateLimit.resetTime - Date.now()) / 1000) },
                { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.resetTime - Date.now()) / 1000)) } }
            );
        }

        const body = await request.json();
        const {
            email,
            password,
            documentNumber,
            biometricType = 'face',
            faceImage,
            faceDescriptor: inputFaceDescriptor,
            fingerprintCredential,
            fingerprintPublicKey
        } = body;
        let faceDescriptor = inputFaceDescriptor;

        if (!email || !password || !documentNumber) {
            return NextResponse.json(
                { error: 'Email, password, and document number are required' },
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

        // Password strength validation
        const passwordValidation = validatePassword(password);
        if (!passwordValidation.valid) {
            return NextResponse.json(
                { error: 'Password does not meet security requirements', details: passwordValidation.errors },
                { status: 400 }
            );
        }

        // Validate biometric data based on type
        if (biometricType === 'face') {
            if (!faceImage || !faceDescriptor) {
                return NextResponse.json(
                    { error: 'Face scan is required for registration' },
                    { status: 400 }
                );
            }

            // Validate face image format and size
            if (typeof faceImage !== 'string' || !faceImage.startsWith('data:image/')) {
                return NextResponse.json(
                    { error: 'Invalid face image format' },
                    { status: 400 }
                );
            }
            // ~2MB limit: base64 overhead is ~1.33x, so 2MB raw ≈ 2.7MB base64
            // ~2MB limit: base64 overhead is ~1.33x, so 2MB raw ≈ 2.7MB base64
            const MAX_IMAGE_BYTES = 2_800_000;
            if (faceImage.length > MAX_IMAGE_BYTES) {
                return NextResponse.json(
                    { error: 'Face image is too large. Please use better lighting instead of a high-res photo.' },
                    { status: 400 }
                );
            }

            // Face++ Detection
            const faceToken = await facePlusPlus.detect(faceImage);
            if (!faceToken) {
                return NextResponse.json(
                    { error: 'Face++ could not detect a face. Please try again with better lighting.' },
                    { status: 400 }
                );
            }
            // Store the token in the descriptor field
            // Note: We are hijacking the faceDescriptor field to store the face_token string
            // logic later will check if it looks like a JSON array (old) or a string (new)
            faceDescriptor = faceToken;

        } else if (biometricType === 'fingerprint') {
            if (!fingerprintCredential || !fingerprintPublicKey) {
                return NextResponse.json(
                    { error: 'Fingerprint registration is required for registration' },
                    { status: 400 }
                );
            }

            if (
                typeof fingerprintCredential !== 'string' ||
                typeof fingerprintPublicKey !== 'string' ||
                !isLikelyBase64Url(fingerprintCredential) ||
                !isLikelyBase64Url(fingerprintPublicKey)
            ) {
                return NextResponse.json(
                    { error: 'Invalid fingerprint credential data' },
                    { status: 400 }
                );
            }
        } else {
            return NextResponse.json(
                { error: 'Invalid biometric type. Must be "face" or "fingerprint"' },
                { status: 400 }
            );
        }

        // Normalize and validate document number
        const normalizedDocNumber = documentNumber.toUpperCase().trim();

        // Verify government record exists
        const govRecord = await prisma.governmentRecord.findUnique({
            where: { documentNumber: normalizedDocNumber },
        });

        if (!govRecord) {
            // Use generic message to prevent enumeration
            return NextResponse.json(
                { error: 'Unable to verify document. Please check your details.' },
                { status: 400 }
            );
        }

        // Check if already registered
        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: email.toLowerCase().trim() },
                    { documentNumber: normalizedDocNumber },
                ],
            },
        });

        if (existingUser) {
            // Don't reveal which field already exists
            return NextResponse.json(
                { error: 'An account with these details already exists' },
                { status: 409 }
            );
        }

        // Create user with biometric data (use higher bcrypt cost)
        const user = await prisma.user.create({
            data: {
                email: email.toLowerCase().trim(),
                passwordHash: hashSync(password, 12), // Increased cost factor
                fullName: govRecord.fullName,
                documentNumber: normalizedDocNumber,
                // Face data (if face biometric)
                faceImageUrl: biometricType === 'face' ? faceImage : null,
                faceDescriptor: biometricType === 'face' ? faceDescriptor : null,
                // Fingerprint data (if fingerprint biometric)
                biometricType: biometricType,
                fingerprintCredential: biometricType === 'fingerprint' ? fingerprintCredential : null,
                fingerprintPublicKey: biometricType === 'fingerprint' ? fingerprintPublicKey : null,
                verified: true,
            },
        });

        // Set session
        await setSessionCookie({
            userId: user.id,
            email: user.email,
            fullName: user.fullName,
            verified: user.verified,
            isAdmin: user.isAdmin,
            sessionId: '', // overwritten inside createSessionToken
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
        // Don't leak error details
        console.error('Registration error:', error);
        return NextResponse.json(
            { error: 'Registration failed. Please try again.' },
            { status: 500 }
        );
    }
}
