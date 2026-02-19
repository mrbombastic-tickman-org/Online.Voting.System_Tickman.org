import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession, checkRateLimit, getClientIP } from '@/lib/auth';

// Euclidean distance — proven reliable for face-api.js 128-dim embeddings
function euclideanDistance(desc1: number[], desc2: number[]): number {
    if (desc1.length !== desc2.length) return Infinity;
    let sum = 0;
    for (let i = 0; i < desc1.length; i++) {
        sum += (desc1[i] - desc2[i]) ** 2;
    }
    return Math.sqrt(sum);
}

// face-api.js 128-dim embeddings:
//   Same person: Euclidean distance ~0.3–0.45
//   Different person: Euclidean distance >0.6
// Threshold of 0.6 provides good balance
const FACE_MATCH_THRESHOLD = 0.45;

// Rate limit: 50 face verification attempts per minute (relaxed for development)
const FACE_RATE_LIMIT = {
    windowMs: 60 * 1000,
    maxRequests: 50,
    message: 'Too many face verification attempts.',
};

export async function POST(request: NextRequest) {
    try {
        // Rate limiting
        const clientIP = getClientIP(request);
        const rateLimit = checkRateLimit(`face-verify:${clientIP}`, FACE_RATE_LIMIT);
        if (!rateLimit.allowed) {
            return NextResponse.json(
                { error: FACE_RATE_LIMIT.message },
                { status: 429 }
            );
        }

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

        // Validate descriptor array
        if (!Array.isArray(incomingDesc) || incomingDesc.length < 64) {
            return NextResponse.json({ error: 'Invalid face descriptor format' }, { status: 400 });
        }

        // Validate all values are finite numbers
        if (!incomingDesc.every(v => typeof v === 'number' && isFinite(v))) {
            return NextResponse.json({ error: 'Invalid face descriptor values' }, { status: 400 });
        }

        // Get the user's stored face descriptor
        const user = await prisma.user.findUnique({
            where: { id: session.userId },
            select: { faceDescriptor: true },
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

        // Dimension mismatch — user needs to re-register with current model
        if (incomingDesc.length !== storedDesc.length) {
            return NextResponse.json({
                verified: false,
                message: 'Face model has been updated. Please re-register to update your biometric data.',
            });
        }

        // Compare face descriptors using Euclidean distance
        const distance = euclideanDistance(incomingDesc, storedDesc);
        const verified = distance < FACE_MATCH_THRESHOLD;

        // Log for debugging (no PII)
        console.log(`Face verification: verified=${verified}, distance=${distance.toFixed(4)}, dim=${incomingDesc.length}`);

        return NextResponse.json({
            verified,
            matchQuality: distance < 0.35 ? 'strong' : distance < FACE_MATCH_THRESHOLD ? 'acceptable' : 'poor',
            message: verified
                ? 'Face verification successful'
                : 'Face verification failed. Please ensure proper lighting and face positioning.',
        });
    } catch (error) {
        console.error('Face verification error:', error);
        return NextResponse.json({ error: 'Face verification failed' }, { status: 500 });
    }
}
