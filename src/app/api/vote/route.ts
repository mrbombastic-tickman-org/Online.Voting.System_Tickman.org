import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import prisma from '@/lib/prisma';
import { getSession, getClientIP, checkRateLimit } from '@/lib/auth';

// Rate limit: 10 vote attempts per minute per IP
const VOTE_RATE_LIMIT = {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
    message: 'Too many vote attempts. Please slow down.',
};

export async function POST(request: NextRequest) {
    try {
        // Rate limiting first
        const clientIP = getClientIP(request);
        const rateLimit = checkRateLimit(`vote:${clientIP}`, VOTE_RATE_LIMIT);
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
        const { candidateId, electionId, faceDescriptor } = body;

        // Validate UUIDs to prevent injection
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!candidateId || !electionId || !uuidRegex.test(candidateId) || !uuidRegex.test(electionId)) {
            return NextResponse.json({ error: 'Invalid request parameters' }, { status: 400 });
        }

        // Require face descriptor for verification at vote time
        // 512-dim for @vladmandic/human
        if (!faceDescriptor || !Array.isArray(faceDescriptor) || faceDescriptor.length !== 512) {
            return NextResponse.json({ error: 'Face verification is required to cast a vote' }, { status: 400 });
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

        // Verify face matches the registered user
        const user = await prisma.user.findUnique({
            where: { id: session.userId },
            select: { faceDescriptor: true },
        });

        if (!user?.faceDescriptor) {
            return NextResponse.json({ error: 'No face biometric registered' }, { status: 400 });
        }

        let storedDescriptor: number[];
        try {
            storedDescriptor = JSON.parse(user.faceDescriptor);
        } catch {
            return NextResponse.json({ error: 'Stored face data corrupted' }, { status: 500 });
        }

        // Calculate Euclidean distance
        const distance = Math.sqrt(
            faceDescriptor.reduce((sum: number, val: number, i: number) =>
                sum + Math.pow(val - (storedDescriptor[i] || 0), 2), 0)
        );

        const FACE_THRESHOLD = 0.6;
        if (distance >= FACE_THRESHOLD) {
            return NextResponse.json({
                error: 'Face verification failed. Please try again.',
                verified: false
            }, { status: 403 });
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
                    ipAddress: clientIP,
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
