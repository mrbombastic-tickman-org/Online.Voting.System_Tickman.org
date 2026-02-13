import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
    try {
        const records = await prisma.governmentRecord.findMany({
            select: {
                documentNumber: true,
                fullName: true,
                dateOfBirth: true,
                address: true,
            },
        });
        return NextResponse.json({ records });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch records' }, { status: 500 });
    }
}
