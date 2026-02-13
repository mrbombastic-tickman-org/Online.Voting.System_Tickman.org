import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession, getClientIP } from '@/lib/auth';

export async function POST(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'You must be logged in to vote' }, { status: 401 });
        }

        if (!session.verified) {
            return NextResponse.json({ error: 'Your identity is not verified. Cannot vote.' }, { status: 403 });
        }

        const { candidateId, electionId, faceImage } = await request.json();

        if (!candidateId || !electionId) {
            return NextResponse.json({ error: 'Candidate and election are required' }, { status: 400 });
        }

        // Verify face was captured (face verification happens on the client via /api/verify-face)
        if (!faceImage) {
            return NextResponse.json({ error: 'Face verification is required to cast a vote' }, { status: 400 });
        }

        // Verify election is active
        const election = await prisma.election.findUnique({ where: { id: electionId } });
        if (!election || !election.isActive) {
            return NextResponse.json({ error: 'This election is not active' }, { status: 400 });
        }

        // Verify candidate belongs to this election
        const candidate = await prisma.candidate.findFirst({
            where: { id: candidateId, electionId },
        });
        if (!candidate) {
            return NextResponse.json({ error: 'Invalid candidate for this election' }, { status: 400 });
        }

        // Get client IP
        const ipAddress = getClientIP(request);

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

        // Check if IP already voted in this election
        const existingIPVote = await prisma.vote.findFirst({
            where: { ipAddress, electionId },
        });
        if (existingIPVote) {
            return NextResponse.json(
                { error: 'A vote has already been cast from this device/network', alreadyVoted: true },
                { status: 409 }
            );
        }

        // Cast the vote
        const vote = await prisma.vote.create({
            data: {
                userId: session.userId,
                candidateId,
                electionId,
                ipAddress,
                deviceFingerprint: request.headers.get('user-agent') || 'unknown',
            },
        });

        return NextResponse.json({
            success: true,
            message: 'Your vote has been successfully recorded!',
            voteId: vote.id,
        });
    } catch (error: any) {
        console.error('Voting error:', error);
        if (error.code === 'P2002') {
            return NextResponse.json(
                { error: 'You have already voted in this election', alreadyVoted: true },
                { status: 409 }
            );
        }
        return NextResponse.json({ error: 'Failed to cast vote' }, { status: 500 });
    }
}
