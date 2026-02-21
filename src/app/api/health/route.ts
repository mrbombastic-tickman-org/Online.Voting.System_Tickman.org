import { NextResponse } from 'next/server';

export async function GET() {
    return NextResponse.json({
        status: 'ok',
        service: 'VoteSecure API',
        timestamp: new Date().toISOString(),
    });
}
