import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

// Euclidean distance between two face descriptors
function euclideanDistance(desc1: number[], desc2: number[]): number {
    if (desc1.length !== desc2.length) return Infinity;
    let sum = 0;
    for (let i = 0; i < desc1.length; i++) {
        sum += (desc1[i] - desc2[i]) ** 2;
    }
    return Math.sqrt(sum);
}

// face-api.js uses ~0.6 threshold for the 128-dim descriptor
const FACE_MATCH_THRESHOLD = 0.6;

export async function POST(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const { faceDescriptor } = await request.json();
        if (!faceDescriptor) {
            return NextResponse.json({ error: 'Face descriptor is required' }, { status: 400 });
        }

        // Parse the incoming descriptor
        let incomingDesc: number[];
        try {
            incomingDesc = typeof faceDescriptor === 'string' ? JSON.parse(faceDescriptor) : faceDescriptor;
        } catch {
            return NextResponse.json({ error: 'Invalid face descriptor format' }, { status: 400 });
        }

        if (!Array.isArray(incomingDesc) || incomingDesc.length !== 128) {
            return NextResponse.json({ error: 'Invalid face descriptor: must be a 128-dimensional vector' }, { status: 400 });
        }

        // Get the user's stored face descriptor
        const user = await prisma.user.findUnique({
            where: { id: session.userId },
            select: { faceDescriptor: true, fullName: true },
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        if (!user.faceDescriptor) {
            return NextResponse.json({
                verified: false,
                error: 'No face biometric registered. Please re-register with face scan.',
            }, { status: 400 });
        }

        // Parse stored descriptor
        let storedDesc: number[];
        try {
            storedDesc = JSON.parse(user.faceDescriptor);
        } catch {
            return NextResponse.json({
                verified: false,
                error: 'Stored face data is corrupted. Please re-register.',
            }, { status: 500 });
        }

        // Compare face descriptors using Euclidean distance
        const distance = euclideanDistance(incomingDesc, storedDesc);
        const verified = distance < FACE_MATCH_THRESHOLD;

        console.log(`Face verification for ${user.fullName}: distance=${distance.toFixed(4)}, threshold=${FACE_MATCH_THRESHOLD}, verified=${verified}`);

        return NextResponse.json({
            verified,
            distance: parseFloat(distance.toFixed(4)),
            threshold: FACE_MATCH_THRESHOLD,
            message: verified
                ? `Face matched! Welcome, ${user.fullName}. (distance: ${distance.toFixed(4)})`
                : `Face does NOT match registered user. Distance: ${distance.toFixed(4)} (threshold: ${FACE_MATCH_THRESHOLD}). Please try again or ensure you are the registered voter.`,
        });
    } catch (error) {
        console.error('Face verification error:', error);
        return NextResponse.json({ error: 'Face verification failed' }, { status: 500 });
    }
}
