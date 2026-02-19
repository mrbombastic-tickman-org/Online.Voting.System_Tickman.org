import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession, isAdmin } from '@/lib/auth';

export async function GET() {
    try {
        // Require authentication
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        // Require admin privileges
        const adminCheck = await isAdmin();
        if (!adminCheck) {
            console.warn(`Unauthorized access attempt to gov-records by: ${session.email}`);
            return NextResponse.json({ error: 'Admin privileges required' }, { status: 403 });
        }

        // Return minimal information - avoid exposing sensitive PII
        const records = await prisma.governmentRecord.findMany({
            select: {
                id: true,
                fullName: true,
                // Only return year of birth for privacy
                dateOfBirth: true,
                // Mask document number
                documentNumber: true,
                // Only return city/region, not full address
                address: true,
            },
            take: 100, // Limit results
        });

        // Mask sensitive data before returning
        const maskedRecords = records.map(r => ({
            id: r.id,
            fullName: r.fullName,
            birthYear: new Date(r.dateOfBirth).getFullYear(),
            documentNumber: `****${r.documentNumber.slice(-4)}`,
            region: r.address.split(',').pop()?.trim() || 'Unknown',
        }));

        return NextResponse.json({ records: maskedRecords });
    } catch (error) {
        console.error('Gov-records error:', error);
        return NextResponse.json({ error: 'Failed to fetch records' }, { status: 500 });
    }
}
