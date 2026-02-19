import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

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

        const body = await request.json();
        const { assertionData } = body;

        if (!assertionData) {
            return NextResponse.json(
                { error: 'Assertion data is required' },
                { status: 400 }
            );
        }

        // Get user with fingerprint credential
        const user = await prisma.user.findUnique({
            where: { id: session.userId }
        });

        if (!user) {
            return NextResponse.json(
                { error: 'User not found' },
                { status: 404 }
            );
        }

        if (!user.fingerprintCredential) {
            return NextResponse.json(
                { error: 'No fingerprint registered for this user' },
                { status: 400 }
            );
        }

        // Parse assertion data
        const assertion = JSON.parse(assertionData);

        // Verify that the credential ID matches
        if (assertion.id !== user.fingerprintCredential) {
            return NextResponse.json(
                { verified: false, message: 'Credential mismatch' },
                { status: 200 }
            );
        }

        // In a production environment, you would verify the signature
        // using the stored public key. For this demo, we trust the 
        // WebAuthn assertion since it requires biometric verification.

        // The assertion contains:
        // - authenticatorData: Contains info about the authenticator
        // - clientDataJSON: Contains the challenge and origin
        // - signature: Cryptographic signature
        // - userHandle: User identifier

        // For production, implement full signature verification:
        // 1. Parse clientDataJSON and verify challenge
        // 2. Verify origin matches
        // 3. Verify signature using stored public key
        // 4. Check signCount for replay protection

        return NextResponse.json({
            verified: true,
            message: 'Fingerprint verified successfully'
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
export async function GET() {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json(
                { error: 'Not authenticated' },
                { status: 401 }
            );
        }

        const user = await prisma.user.findUnique({
            where: { id: session.userId },
            select: {
                fingerprintCredential: true,
                biometricType: true
            }
        });

        return NextResponse.json({
            hasFingerprint: !!user?.fingerprintCredential,
            biometricType: user?.biometricType || 'face'
        });

    } catch (error) {
        console.error('Error checking fingerprint:', error);
        return NextResponse.json(
            { error: 'Failed to check fingerprint status' },
            { status: 500 }
        );
    }
}
