import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import prisma from '@/lib/prisma';
import { getSession, getClientIP, checkRateLimit } from '@/lib/auth';
import { facePlusPlus } from '@/lib/faceplusplus';
import { isIpTrackingEnabled } from '@/lib/ip-tracking';

// Rate limit: 10 vote attempts per minute per IP
const VOTE_RATE_LIMIT = {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
    message: 'Too many vote attempts. Please slow down.',
};

export async function POST(request: NextRequest) {
    try {
        // Rate limiting — use IP when tracking is on, userId otherwise
        const clientIP = getClientIP(request);
        const ipEnabled = isIpTrackingEnabled();
        const rateLimitKey = `vote:${clientIP}`;
        const rateLimit = checkRateLimit(rateLimitKey, VOTE_RATE_LIMIT);
        if (!rateLimit.allowed) {
            return NextResponse.json(
                { error: VOTE_RATE_LIMIT.message },
                { status: 429 }
            );
        }

        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'You must be logged in to vote' }, { status: 401 });
        }

        if (!session.verified) {
            return NextResponse.json({ error: 'Your identity is not verified. Cannot vote.' }, { status: 403 });
        }

        const body = await request.json();
        const { candidateId, electionId, faceImage, fingerprintAssertion, biometricType = 'face' } = body;

        // Validate format (UUID or Slug) - alphanumeric with hyphens/underscores
        // Seeded data might use 'election-2026' etc.
        const idRegex = /^[a-zA-Z0-9\-_]+$/;
        if (!candidateId || !electionId || !idRegex.test(candidateId) || !idRegex.test(electionId)) {
            return NextResponse.json({ error: 'Invalid request parameters' }, { status: 400 });
        }

        // Biometric verification is REQUIRED for vote
        if (biometricType === 'face') {
            if (!faceImage || typeof faceImage !== 'string') {
                return NextResponse.json({ error: 'Face image is required for verification' }, { status: 400 });
            }
        } else if (biometricType === 'fingerprint') {
            if (!fingerprintAssertion) {
                return NextResponse.json({ error: 'Fingerprint assertion is required' }, { status: 400 });
            }
        } else {
            return NextResponse.json({ error: 'Invalid biometric type' }, { status: 400 });
        }

        // Verify election is active and within date range
        const now = new Date();
        const election = await prisma.election.findUnique({ where: { id: electionId } });
        if (!election || !election.isActive) {
            return NextResponse.json({ error: 'This election is not active' }, { status: 400 });
        }
        if (now < election.startDate || now > election.endDate) {
            return NextResponse.json({ error: 'This election is not currently open for voting' }, { status: 400 });
        }

        // Verify candidate belongs to this election
        const candidate = await prisma.candidate.findFirst({
            where: { id: candidateId, electionId },
        });
        if (!candidate) {
            return NextResponse.json({ error: 'Invalid candidate for this election' }, { status: 400 });
        }

        // Verify biometric matches the registered user
        const user = await prisma.user.findUnique({
            where: { id: session.userId },
            select: {
                faceDescriptor: true,
                fingerprintCredential: true,
                biometricType: true
            },
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Verify based on biometric type
        if (biometricType === 'face') {
            if (!user.faceDescriptor) {
                return NextResponse.json({ error: 'No face biometric registered' }, { status: 400 });
            }

            const storedToken = user.faceDescriptor;

            // Check if it's a legacy JSON-array descriptor (old face-api.js data)
            if (storedToken.trim().startsWith('[')) {
                return NextResponse.json({
                    error: 'Legacy face data detected. Please re-register to upgrade to Face++.',
                    verified: false
                }, { status: 400 });
            }

            // Use Face++ to compare the stored token with the live image
            const confidence = await facePlusPlus.compare(storedToken, faceImage);
            if (confidence < 0) {
                return NextResponse.json({
                    error: 'Face verification service error. Please try again.',
                    verified: false
                }, { status: 500 });
            }

            const FACE_THRESHOLD = 75;
            if (confidence < FACE_THRESHOLD) {
                return NextResponse.json({
                    error: 'Face verification failed. Please try again.',
                    verified: false
                }, { status: 403 });
            }
        } else if (biometricType === 'fingerprint') {
            // For fingerprint, we trust the WebAuthn assertion verification
            // that was done in the verify-fingerprint endpoint
            if (!user.fingerprintCredential) {
                return NextResponse.json({ error: 'No fingerprint biometric registered' }, { status: 400 });
            }

            // Parse and validate the assertion
            try {
                const assertion = JSON.parse(fingerprintAssertion);
                if (assertion.id !== user.fingerprintCredential) {
                    return NextResponse.json({
                        error: 'Fingerprint verification failed. Credential mismatch.',
                        verified: false
                    }, { status: 403 });
                }
            } catch {
                return NextResponse.json({ error: 'Invalid fingerprint assertion' }, { status: 400 });
            }
        }

        // Check if user already voted in this election
        const existingUserVote = await prisma.vote.findFirst({
            where: { userId: session.userId, electionId },
        });
        if (existingUserVote) {
            return NextResponse.json(
                { error: 'You have already cast your vote in this election', alreadyVoted: true },
                { status: 409 }
            );
        }

        // Note: IP-based check is supplemental only - can be bypassed
        // Primary protection is userId uniqueness constraint

        // Cast the vote (transaction for atomicity)
        const vote = await prisma.$transaction(async (tx) => {
            // Build a more robust device fingerprint (hash of UA + language)
            const ua = request.headers.get('user-agent') || 'unknown';
            const lang = request.headers.get('accept-language') || '';
            const deviceFingerprint = createHash('sha256')
                .update(`${ua}|${lang}`)
                .digest('hex')
                .substring(0, 64);

            return tx.vote.create({
                data: {
                    userId: session.userId,
                    candidateId,
                    electionId,
                    ipAddress: ipEnabled ? clientIP : 'disabled',
                    deviceFingerprint,
                },
            });
        });

        return NextResponse.json({
            success: true,
            message: 'Your vote has been successfully recorded!',
            voteId: vote.id,
        });
    } catch (error: unknown) {
        console.error('Voting error:', error);

        // Handle unique constraint violation
        if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
            return NextResponse.json(
                { error: 'You have already voted in this election', alreadyVoted: true },
                { status: 409 }
            );
        }
        return NextResponse.json({ error: 'Failed to cast vote' }, { status: 500 });
    }
}
