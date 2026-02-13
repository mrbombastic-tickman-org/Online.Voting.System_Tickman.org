import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

const ADMIN_EMAIL = 'admin@votesecure.in';

export async function GET() {
    try {
        // Auth guard: only admin can access stats
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }
        if (session.email !== ADMIN_EMAIL) {
            return NextResponse.json({ error: 'Admin privileges required' }, { status: 403 });
        }

        const totalUsers = await prisma.user.count();
        const verifiedUsers = await prisma.user.count({ where: { verified: true } });
        const totalVotes = await prisma.vote.count();

        const elections = await prisma.election.findMany({
            include: {
                candidates: {
                    include: {
                        _count: { select: { votes: true } },
                    },
                },
                _count: { select: { votes: true } },
            },
        });

        const recentVotes = await prisma.vote.findMany({
            take: 20,
            orderBy: { votedAt: 'desc' },
            select: {
                id: true,
                ipAddress: true,
                votedAt: true,
                candidate: { select: { name: true, party: true } },
                election: { select: { title: true } },
            },
        });

        return NextResponse.json({
            stats: {
                totalUsers,
                verifiedUsers,
                totalVotes,
            },
            elections: elections.map((e) => ({
                id: e.id,
                title: e.title,
                isActive: e.isActive,
                totalVotes: e._count.votes,
                candidates: e.candidates.map((c) => ({
                    id: c.id,
                    name: c.name,
                    party: c.party,
                    symbol: c.symbol,
                    votes: c._count.votes,
                })),
            })),
            recentVotes: recentVotes.map((v) => ({
                id: v.id,
                ipAddress: v.ipAddress.replace(/\d+\.\d+$/, '*.***'),
                votedAt: v.votedAt,
                candidate: v.candidate.name,
                party: v.candidate.party,
                election: v.election.title,
            })),
        });
    } catch (error) {
        console.error('Admin stats error:', error);
        return NextResponse.json({ error: 'Failed to fetch admin stats' }, { status: 500 });
    }
}
