import { NextRequest, NextResponse } from 'next/server';
import { clearSession, verifyCSRF } from '@/lib/auth';

export async function POST(request: NextRequest) {
    if (!(await verifyCSRF(request))) {
        return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 });
    }

    await clearSession();
    return NextResponse.json({ success: true });
}
