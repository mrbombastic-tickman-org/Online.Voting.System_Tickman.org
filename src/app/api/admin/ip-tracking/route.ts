import { NextResponse } from 'next/server';
import { getSession, verifyCSRF } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { isIpTrackingEnabled, setIpTrackingEnabled } from '@/lib/ip-tracking';

export async function GET() {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    return NextResponse.json({ ipTrackingEnabled: isIpTrackingEnabled() });
}

export async function POST(request: Request) {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    if (!(await verifyCSRF(request))) {
        return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 });
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

async function requireAdmin(): Promise<
    { ok: true } | { ok: false; response: NextResponse }
> {
    const session = await getSession();
    if (!session) {
        return {
            ok: false,
            response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
        };
    }

    const user = await prisma.user.findUnique({
        where: { id: session.userId },
        select: { isAdmin: true },
    });

    if (!user?.isAdmin) {
        return {
            ok: false,
            response: NextResponse.json({ error: 'Admin access required' }, { status: 403 }),
        };
    }

    return { ok: true };
}
