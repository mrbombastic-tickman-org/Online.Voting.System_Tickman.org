import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession, checkRateLimit, getRateLimitIdentifier, verifyCSRF } from '@/lib/auth';
import { facePlusPlus } from '@/lib/faceplusplus';
import { issueFaceProof, FACE_PROOF_TTL_SECONDS } from '@/lib/face-proof';

// Rate limit: 50 face verification attempts per minute
const FACE_RATE_LIMIT = {
    windowMs: 60 * 1000,
    maxRequests: 50,
    message: 'Too many face verification attempts.',
};

export async function POST(request: NextRequest) {
    try {
        const rateLimit = checkRateLimit(
            getRateLimitIdentifier(request, 'face-verify'),
            FACE_RATE_LIMIT
        );
        if (!rateLimit.allowed) {
            return NextResponse.json({ error: FACE_RATE_LIMIT.message }, { status: 429 });
        }

        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        if (!(await verifyCSRF(request))) {
            return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 });
        }

        const { faceImage } = await request.json();
        if (!faceImage) {
            return NextResponse.json({ error: 'Face image is required' }, { status: 400 });
        }

        const user = await prisma.user.findUnique({
            where: { id: session.userId },
            select: { faceDescriptor: true },
        });

        if (!user || !user.faceDescriptor) {
            return NextResponse.json({ verified: false, error: 'No face biometric registered.' }, { status: 400 });
        }

        const storedToken = user.faceDescriptor;
        if (storedToken.trim().startsWith('[')) {
            return NextResponse.json({
                verified: false,
                message: 'Legacy face data detected. Please re-register to upgrade to Face++.',
            });
        }

        const comparison = await facePlusPlus.compare(storedToken, faceImage);
        if (!comparison) {
            return NextResponse.json({ verified: false, error: 'Face verification service error.' }, { status: 500 });
        }

        const verified = comparison.confidence >= comparison.threshold;
        const confidenceDelta = comparison.confidence - comparison.threshold;
        const matchQuality = confidenceDelta >= 8 ? 'strong' : confidenceDelta >= 0 ? 'acceptable' : 'mismatch';

        console.log(
            `Face++ Verification: confidence=${comparison.confidence}, threshold=${comparison.threshold}, verified=${verified}`
        );

        if (!verified) {
            const nearMatch = comparison.confidence >= comparison.threshold - 4;
            return NextResponse.json({
                verified: false,
                confidence: comparison.confidence,
                threshold: comparison.threshold,
                matchQuality,
                message: nearMatch
                    ? 'Almost matched. Keep your face centered and steady, then retry.'
                    : 'Face mismatch. Please try again.',
            }, { status: 403 });
        }

        const faceProof = issueFaceProof(session.userId, comparison.confidence, comparison.threshold);
        return NextResponse.json({
            verified: true,
            confidence: comparison.confidence,
            threshold: comparison.threshold,
            matchQuality,
            faceProof,
            proofExpiresInSeconds: FACE_PROOF_TTL_SECONDS,
            message: 'Identity verified successfully',
        });
    } catch (error) {
        console.error('Face verification error:', error);
        return NextResponse.json({ error: 'Face verification failed' }, { status: 500 });
    }
}
