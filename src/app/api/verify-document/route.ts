import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const docNumber = searchParams.get('documentNumber');

    if (!docNumber) {
        return NextResponse.json(
            { error: 'Document number is required' },
            { status: 400 }
        );
    }

    const record = await prisma.governmentRecord.findUnique({
        where: { documentNumber: docNumber },
    });

    if (!record) {
        return NextResponse.json(
            { error: 'No government record found with this document number' },
            { status: 404 }
        );
    }

    // Check if already registered
    const existingUser = await prisma.user.findUnique({
        where: { documentNumber: docNumber },
    });

    if (existingUser) {
        return NextResponse.json(
            { error: 'This document number is already registered' },
            { status: 409 }
        );
    }

    return NextResponse.json({
        success: true,
        record: {
            fullName: record.fullName,
            dateOfBirth: record.dateOfBirth,
            documentNumber: record.documentNumber,
            address: record.address,
        },
    });
}
