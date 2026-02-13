import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET() {
    try {
        const session = await getSession();

        const elections = await prisma.election.findMany({
            where: { isActive: true },
            include: {
                candidates: true,
                _count: { select: { votes: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        // Check if user already voted
        let userVotes: Record<string, string> = {};
        if (session) {
            const votes = await prisma.vote.findMany({
                where: { userId: session.userId },
                select: { electionId: true, candidateId: true },
            });
            userVotes = votes.reduce((acc, v) => {
                acc[v.electionId] = v.candidateId;
                return acc;
            }, {} as Record<string, string>);
        }

        return NextResponse.json({
            elections: elections.map((e) => ({
                id: e.id,
                title: e.title,
                description: e.description,
                startDate: e.startDate,
                endDate: e.endDate,
                isActive: e.isActive,
                totalVotes: e._count.votes,
                candidates: e.candidates.map((c) => ({
                    id: c.id,
                    name: c.name,
                    party: c.party,
                    symbol: c.symbol,
                })),
                userVotedFor: userVotes[e.id] || null,
            })),
        });
    } catch (error) {
        console.error('Elections error:', error);
        return NextResponse.json({ error: 'Failed to fetch elections' }, { status: 500 });
    }
}
