import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { checkRateLimit, getRateLimitIdentifier } from '@/lib/auth';

// Rate limit: 50 document checks per minute
const DOC_RATE_LIMIT = {
    windowMs: 60 * 1000,
    maxRequests: 50,
    message: 'Too many document verification attempts.',
};

export async function GET(request: NextRequest) {
    try {
        // Rate limiting
        const rateLimit = checkRateLimit(
            getRateLimitIdentifier(request, 'doc-verify'),
            DOC_RATE_LIMIT
        );
        if (!rateLimit.allowed) {
            return NextResponse.json(
                { error: DOC_RATE_LIMIT.message },
                { status: 429 }
            );
        }

        const { searchParams } = new URL(request.url);
        const docNumber = searchParams.get('documentNumber');

        if (!docNumber) {
            return NextResponse.json(
                { error: 'Document number is required' },
                { status: 400 }
            );
        }

        // Validate document number format (adjust regex based on your document format)
        const normalizedDocNumber = docNumber.toUpperCase().trim();
        if (normalizedDocNumber.length < 3 || normalizedDocNumber.length > 30) {
            return NextResponse.json(
                { error: 'Invalid document number format' },
                { status: 400 }
            );
        }

        const record = await prisma.governmentRecord.findUnique({
            where: { documentNumber: normalizedDocNumber },
        });

        if (!record) {
            // Generic message to prevent enumeration
            return NextResponse.json(
                { error: 'Unable to verify document. Please check your details.' },
                { status: 404 }
            );
        }

        // Check if already registered
        const existingUser = await prisma.user.findUnique({
            where: { documentNumber: normalizedDocNumber },
            select: { id: true }, // Only select what we need
        });

        if (existingUser) {
            return NextResponse.json(
                { error: 'This document number is already registered' },
                { status: 409 }
            );
        }

        // Return minimal information needed for registration
        // Don't expose full address or other sensitive details
        return NextResponse.json({
            success: true,
            record: {
                fullName: record.fullName,
                // Only show partial DOB for verification (month/year)
                dateOfBirthYear: new Date(record.dateOfBirth).getFullYear(),
                // Don't expose full document number again
                documentNumberLast4: record.documentNumber.slice(-4),
                // Don't expose full address - only city/region if needed
                region: record.address.split(',').pop()?.trim() || '',
            },
        });
    } catch (error: unknown) {
        console.error('Document verification error:', error);
        return NextResponse.json(
            { error: 'Document verification failed' },
            { status: 500 }
        );
    }
}
