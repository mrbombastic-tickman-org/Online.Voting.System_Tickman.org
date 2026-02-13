import { NextRequest, NextResponse } from 'next/server';
import { hashSync } from 'bcryptjs';
import prisma from '@/lib/prisma';
import { setSessionCookie } from '@/lib/auth';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { email, password, documentNumber, faceImage, faceDescriptor } = body;

        if (!email || !password || !documentNumber) {
            return NextResponse.json(
                { error: 'Email, password, and document number are required' },
                { status: 400 }
            );
        }

        if (!faceImage || !faceDescriptor) {
            return NextResponse.json(
                { error: 'Face scan is required for registration' },
                { status: 400 }
            );
        }

        // Verify government record exists
        const govRecord = await prisma.governmentRecord.findUnique({
            where: { documentNumber },
        });

        if (!govRecord) {
            return NextResponse.json(
                { error: 'Invalid government document number' },
                { status: 400 }
            );
        }

        // Check if already registered
        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [
                    { email },
                    { documentNumber },
                ],
            },
        });

        if (existingUser) {
            return NextResponse.json(
                { error: existingUser.email === email ? 'Email already registered' : 'Document number already registered' },
                { status: 409 }
            );
        }

        // Create user with face descriptor
        const user = await prisma.user.create({
            data: {
                email,
                passwordHash: hashSync(password, 10),
                fullName: govRecord.fullName,
                documentNumber,
                faceImageUrl: faceImage,
                faceDescriptor: faceDescriptor,
                verified: true,
            },
        });

        // Set session
        await setSessionCookie({
            userId: user.id,
            email: user.email,
            fullName: user.fullName,
            verified: user.verified,
        });

        return NextResponse.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                fullName: user.fullName,
                verified: user.verified,
            },
        });
    } catch (error: any) {
        console.error('Registration error:', error);
        return NextResponse.json(
            { error: 'Registration failed. Please try again.' },
            { status: 500 }
        );
    }
}
