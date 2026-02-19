
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession, checkRateLimit, getClientIP } from '@/lib/auth';
import { facePlusPlus } from '@/lib/faceplusplus';

// Rate limit: 50 face verification attempts per minute
const FACE_RATE_LIMIT = {
    windowMs: 60 * 1000,
    maxRequests: 50,
    message: 'Too many face verification attempts.',
};

export async function POST(request: NextRequest) {
    try {
        // ... (keep rate limit and session check)
        const clientIP = getClientIP(request);
        const rateLimit = checkRateLimit(`face-verify:${clientIP}`, FACE_RATE_LIMIT);
        if (!rateLimit.allowed) {
            return NextResponse.json({ error: FACE_RATE_LIMIT.message }, { status: 429 });
        }

        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const { faceImage } = await request.json(); // Expect faceImage now
        if (!faceImage) {
            return NextResponse.json({ error: 'Face image is required' }, { status: 400 });
        }

        // Get the user's stored face token
        const user = await prisma.user.findUnique({
            where: { id: session.userId },
            select: { faceDescriptor: true }, // This now holds the face_token string
        });

        if (!user || !user.faceDescriptor) {
            return NextResponse.json({ verified: false, error: 'No face biometric registered.' }, { status: 400 });
        }

        // Call Face++ Compare
        // user.faceDescriptor is the face_token (e.g., "302302302...") or the old JSON array (legacy)
        // We should check if it's a valid token type (string not starting with [)
        const storedToken = user.faceDescriptor;
        if (storedToken.trim().startsWith('[')) {
            return NextResponse.json({
                verified: false,
                message: 'Legacy face data detected. Please re-register to upgrade to Face++.',
            });
        }

        const confidence = await facePlusPlus.compare(storedToken, faceImage);

        // Face++ thresholds:
        // 1e-3: ~62.3
        // 1e-4: ~69.0
        // 1e-5: ~75.0 (High security)
        // We can use 80 for very high confidence, or 75.
        const verified = confidence > 75;

        console.log(`Face++ Verification: confidence=${confidence}, verified=${verified}`);

        return NextResponse.json({
            verified,
            matchQuality: confidence > 90 ? 'strong' : 'acceptable',
            message: verified
                ? 'Identity verified successfully'
                : 'Face mismatch. Please try again.',
        });

    } catch (error) {
        console.error('Face verification error:', error);
        return NextResponse.json({ error: 'Face verification failed' }, { status: 500 });
    }
}
