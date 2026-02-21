import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession, verifyCSRF } from '@/lib/auth';

interface StartElectionPayload {
    title?: string;
    description?: string;
    startDate?: string;
    endDate?: string;
    candidates?: Array<{
        name?: string;
        party?: string;
        symbol?: string;
    }>;
}

const DEFAULT_CANDIDATES = [
    { name: 'Rajesh Kumar', party: 'National Progress Party', symbol: '🌸' },
    { name: 'Sunita Devi', party: "People's Alliance", symbol: '🌾' },
    { name: 'Mohammed Faiz', party: 'Democratic Front', symbol: '⭐' },
    { name: 'Lakshmi Narayanan', party: 'Unity Coalition', symbol: '🕊️' },
];

export async function POST(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const admin = await prisma.user.findUnique({
            where: { id: session.userId },
            select: { isAdmin: true },
        });
        if (!admin?.isAdmin) {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        if (!(await verifyCSRF(request))) {
            return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 });
        }

        const body = await request.json() as StartElectionPayload;

        const title = (body.title || '').trim() || `General Election ${new Date().getFullYear()}`;
        const description = (body.description || '').trim() || 'National election started by admin.';

        const now = new Date();
        const startDate = body.startDate ? new Date(body.startDate) : now;
        const endDate = body.endDate
            ? new Date(body.endDate)
            : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

        if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
            return NextResponse.json({ error: 'Invalid start/end date' }, { status: 400 });
        }

        if (endDate <= startDate) {
            return NextResponse.json({ error: 'End date must be after start date' }, { status: 400 });
        }

        const candidates = Array.isArray(body.candidates) && body.candidates.length > 0
            ? body.candidates
                .map((candidate) => ({
                    name: (candidate.name || '').trim(),
                    party: (candidate.party || '').trim(),
                    symbol: (candidate.symbol || '').trim() || '🏛️',
                }))
                .filter((candidate) => candidate.name && candidate.party)
            : DEFAULT_CANDIDATES;

        if (candidates.length < 2) {
            return NextResponse.json(
                { error: 'At least 2 valid candidates are required to start an election' },
                { status: 400 }
            );
        }

        const election = await prisma.$transaction(async (tx) => {
            await tx.election.updateMany({
                where: { isActive: true },
                data: { isActive: false },
            });

            return tx.election.create({
                data: {
                    title,
                    description,
                    startDate,
                    endDate,
                    isActive: true,
                    candidates: {
                        create: candidates.map((candidate) => ({
                            name: candidate.name,
                            party: candidate.party,
                            symbol: candidate.symbol,
                        })),
                    },
                },
                include: {
                    candidates: true,
                },
            });
        });

        return NextResponse.json({
            success: true,
            election: {
                id: election.id,
                title: election.title,
                startDate: election.startDate,
                endDate: election.endDate,
                candidates: election.candidates.length,
            },
        });
    } catch (error) {
        console.error('Start election error:', error);
        return NextResponse.json({ error: 'Failed to start election' }, { status: 500 });
    }
}
