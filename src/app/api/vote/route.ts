import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import prisma from '@/lib/prisma';
import {
    getSession,
    getClientIP,
    checkRateLimit,
    verifyCSRF,
    getRateLimitIdentifier,
} from '@/lib/auth';
import { facePlusPlus } from '@/lib/faceplusplus';
import { isIpTrackingEnabled } from '@/lib/ip-tracking';
import { consumeFingerprintVerification } from '@/lib/fingerprint-session';

// Rate limit: 50 vote attempts per minute
const VOTE_RATE_LIMIT = {
    windowMs: 60 * 1000,
    maxRequests: 50,
    message: 'Too many vote attempts. Please slow down.',
};

export async function POST(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'You must be logged in to vote' }, { status: 401 });
        }

        if (!(await verifyCSRF(request))) {
            return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 });
        }

        if (!session.verified) {
            return NextResponse.json({ error: 'Your identity is not verified. Cannot vote.' }, { status: 403 });
        }

        const clientIP = getClientIP(request);
        const ipEnabled = isIpTrackingEnabled();
        const rateLimitKey = ipEnabled
            ? getRateLimitIdentifier(request, 'vote')
            : `vote:user:${session.userId}`;
        const rateLimit = checkRateLimit(rateLimitKey, VOTE_RATE_LIMIT);

        if (!rateLimit.allowed) {
            return NextResponse.json(
                { error: VOTE_RATE_LIMIT.message },
                { status: 429 }
            );
        }

        const body = await request.json();
        const { candidateId, electionId, faceImage, biometricType = 'face' } = body;

        const idRegex = /^[a-zA-Z0-9\-_]+$/;
        if (!candidateId || !electionId || !idRegex.test(candidateId) || !idRegex.test(electionId)) {
            return NextResponse.json({ error: 'Invalid request parameters' }, { status: 400 });
        }

        if (biometricType === 'face') {
            if (!faceImage || typeof faceImage !== 'string') {
                return NextResponse.json({ error: 'Face image is required for verification' }, { status: 400 });
            }
        } else if (biometricType !== 'fingerprint') {
            return NextResponse.json({ error: 'Invalid biometric type' }, { status: 400 });
        }

        const now = new Date();
        const election = await prisma.election.findUnique({ where: { id: electionId } });
        if (!election || !election.isActive) {
            return NextResponse.json({ error: 'This election is not active' }, { status: 400 });
        }
        if (now < election.startDate || now > election.endDate) {
            return NextResponse.json({ error: 'This election is not currently open for voting' }, { status: 400 });
        }

        const candidate = await prisma.candidate.findFirst({
            where: { id: candidateId, electionId },
        });
        if (!candidate) {
            return NextResponse.json({ error: 'Invalid candidate for this election' }, { status: 400 });
        }

        const user = await prisma.user.findUnique({
            where: { id: session.userId },
            select: {
                faceDescriptor: true,
                fingerprintCredential: true,
            },
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        if (biometricType === 'face') {
            if (!user.faceDescriptor) {
                return NextResponse.json({ error: 'No face biometric registered' }, { status: 400 });
            }

            const storedToken = user.faceDescriptor;
            if (storedToken.trim().startsWith('[')) {
                return NextResponse.json({
                    error: 'Legacy face data detected. Please re-register to upgrade to Face++.',
                    verified: false,
                }, { status: 400 });
            }

            const confidence = await facePlusPlus.compare(storedToken, faceImage);
            if (confidence < 0) {
                return NextResponse.json({
                    error: 'Face verification service error. Please try again.',
                    verified: false,
                }, { status: 500 });
            }

            const FACE_THRESHOLD = 75;
            if (confidence < FACE_THRESHOLD) {
                return NextResponse.json({
                    error: 'Face verification failed. Please try again.',
                    verified: false,
                }, { status: 403 });
            }
        } else {
            if (!user.fingerprintCredential) {
                return NextResponse.json({ error: 'No fingerprint biometric registered' }, { status: 400 });
            }
        }

        const existingUserVote = await prisma.vote.findFirst({
            where: { userId: session.userId, electionId },
        });
        if (existingUserVote) {
            return NextResponse.json(
                { error: 'You have already cast your vote in this election', alreadyVoted: true },
                { status: 409 }
            );
        }

        if (biometricType === 'fingerprint' && !consumeFingerprintVerification(session.userId)) {
            return NextResponse.json(
                { error: 'Fingerprint verification is required before casting your vote' },
                { status: 403 }
            );
        }

        const ua = request.headers.get('user-agent') || 'unknown';
        const lang = request.headers.get('accept-language') || '';
        const deviceFingerprint = createHash('sha256')
            .update(`${ua}|${lang}`)
            .digest('hex')
            .substring(0, 64);

        // Enforcement mode:
        // - ON: same IP or same device can vote only once per election (across users)
        // - OFF: this cross-user device/IP enforcement is skipped for testing
        if (ipEnabled) {
            const duplicateWhere: Array<{
                ipAddress?: string;
                deviceFingerprint?: string;
            }> = [{ deviceFingerprint }];

            if (clientIP !== 'unknown') {
                duplicateWhere.push({ ipAddress: clientIP });
            }

            const existingIpOrDeviceVote = await prisma.vote.findFirst({
                where: {
                    electionId,
                    OR: duplicateWhere,
                },
                select: { id: true },
            });

            if (existingIpOrDeviceVote) {
                return NextResponse.json(
                    {
                        error: 'IP/device has already voted in this election. Disable IP tracking in admin only for testing.',
                        alreadyVoted: true,
                    },
                    { status: 409 }
                );
            }
        }

        const vote = await prisma.$transaction(async (tx) => {
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

        if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
            return NextResponse.json(
                { error: 'You have already voted in this election', alreadyVoted: true },
                { status: 409 }
            );
        }
        return NextResponse.json({ error: 'Failed to cast vote' }, { status: 500 });
    }
}
