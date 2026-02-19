import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { isIpTrackingEnabled, setIpTrackingEnabled } from '@/lib/ip-tracking';

export async function GET() {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({ ipTrackingEnabled: isIpTrackingEnabled() });
}

export async function POST(request: Request) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
        where: { id: session.userId },
        select: { isAdmin: true },
    });

    if (!user?.isAdmin) {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    if (typeof body.enabled !== 'boolean') {
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    setIpTrackingEnabled(body.enabled);

    return NextResponse.json({
        ipTrackingEnabled: isIpTrackingEnabled(),
        message: `IP tracking ${isIpTrackingEnabled() ? 'enabled' : 'disabled'}`,
    });
}
