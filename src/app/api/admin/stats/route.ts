import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET() {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        // Use DB-backed isAdmin flag (set at login, not env emails)
        if (!session.isAdmin) {
            console.warn(`Unauthorized admin access attempt by: ${session.email}`);
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
            // Mask IP addresses more thoroughly for privacy
            recentVotes: recentVotes.map((v) => ({
                id: v.id,
                ipAddress: maskIPAddress(v.ipAddress),
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

// Mask IP address for privacy (show less info)
function maskIPAddress(ip: string): string {
    if (ip === 'unknown') return 'unknown';
    const parts = ip.split('.');
    if (parts.length === 4) {
        // Only show first octet
        return `${parts[0]}.***.***.***`;
    }
    // Handle IPv6
    if (ip.includes(':')) {
        const v6parts = ip.split(':');
        return `${v6parts[0]}:****:****:****`;
    }
    return '***.***.***.***';
}
