'use client';
import { useRef, useState, useCallback, useEffect } from 'react';
// Type-only import — erased at runtime, so no Node.js bundle loaded at SSR
import type { Human, Config, Result } from '@vladmandic/human';

// ─── Singleton Human instance ───────────────────────────────────────────────
let humanInstance: Human | null = null;
let humanLoadPromise: Promise<Human> | null = null;

const humanConfig: Partial<Config> = {
    debug: false,
    // Use WebAssembly backend — works on any CPU with no GPU needed
    backend: 'wasm' as const,
    // Warm up on load so first detection is fast
    warmup: 'none',
    // Only enable what we need: face detection + description
    face: {
        enabled: true,
        detector: { enabled: true, rotation: true, maxDetected: 1, minConfidence: 0.5 },
        mesh: { enabled: true },
        attention: { enabled: false },
        iris: { enabled: false },
        description: { enabled: true, minConfidence: 0.5 }, // 512-dim embedding
        emotion: { enabled: false },
        antispoof: { enabled: false },
        liveness: { enabled: false },
    },
    body: { enabled: false },
    hand: { enabled: false },
    object: { enabled: false },
    gesture: { enabled: false },
    segmentation: { enabled: false },
};

async function getHuman(): Promise<Human> {
    if (humanInstance) return humanInstance;
    if (humanLoadPromise) return humanLoadPromise;

    humanLoadPromise = (async () => {
        // Explicitly import the ESM browser build — prevents Next.js from
        // accidentally resolving to human.node.js during SSR.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        // @ts-ignore — no .d.ts for the ESM path; webpack alias handles the correct build
        const mod: any = await import('@vladmandic/human/dist/human.esm.js');
        const HumanClass: typeof Human = mod.Human ?? mod.default;
        const h = new HumanClass(humanConfig);
        await h.load();
        humanInstance = h;
        return h;
    })();

    return humanLoadPromise;
}

// ─── React hook ─────────────────────────────────────────────────────────────
export function useFaceDetection() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const [status, setStatus] = useState<
        'idle' | 'loading' | 'ready' | 'capturing' | 'detected' | 'no-face' | 'error'
    >('idle');
    const [faceDescriptor, setFaceDescriptor] = useState<number[] | null>(null);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState('');

    // Stop camera on unmount
    useEffect(() => {
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(t => t.stop());
                streamRef.current = null;
            }
        };
    }, []);

    const startCamera = useCallback(async () => {
        // Stop any existing stream
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }

        setStatus('loading');
        setErrorMsg('');

        try {
            console.log('[Human] Loading face models…');
            await getHuman(); // preload models while camera starts
            console.log('[Human] Models ready');

            // Polyfill for older browsers
            if (!navigator.mediaDevices?.getUserMedia) {
                throw new Error('Camera not supported in this browser.');
            }

            const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
            console.log('[Human] Camera access granted');
            streamRef.current = mediaStream;

            // Give the video element a tick to render
            await new Promise(resolve => setTimeout(resolve, 100));

            if (!videoRef.current) throw new Error('Video element not found');
            videoRef.current.srcObject = mediaStream;
            await videoRef.current.play();
            console.log('[Human] Video playing');

            setStatus('ready');
        } catch (err: unknown) {
            console.error('[Human] Camera start error:', err);
            setStatus('error');
            const e = err as { name?: string; message?: string };
            if (e?.name === 'NotAllowedError') {
                setErrorMsg('Camera permission denied. Please allow access.');
            } else if (e?.name === 'NotFoundError') {
                setErrorMsg('No camera found on this device.');
            } else if (e?.name === 'NotReadableError') {
                setErrorMsg('Camera is in use by another application.');
            } else {
                setErrorMsg(`Camera error: ${e?.message || 'Unknown error'}`);
            }
        }
    }, []);

    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
    }, []);

    const captureAndDetect = useCallback(async () => {
        if (!videoRef.current || !canvasRef.current) return null;
        setStatus('capturing');
        setErrorMsg('');

        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        ctx.drawImage(video, 0, 0, 640, 480);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setCapturedImage(dataUrl);

        try {
            const human = await getHuman();
            console.log('[Human] Running detection…');
            const result: Result = await human.detect(video);

            const face = result.face?.[0];
            if (!face || !face.embedding || face.embedding.length === 0) {
                setStatus('no-face');
                setErrorMsg('No face detected. Make sure your face is clearly visible and well-lit.');
                setCapturedImage(null);
                return null;
            }

            stopCamera();
            const descriptor = Array.from(face.embedding) as number[];
            setFaceDescriptor(descriptor);
            setStatus('detected');

            console.log(`[Human] Face detected — embedding length: ${descriptor.length}, confidence: ${face.faceScore?.toFixed(3)}`);

            return {
                descriptor,
                image: dataUrl,
                score: face.faceScore ?? 0,
            };
        } catch (err) {
            console.error('[Human] Detection error:', err);
            setStatus('error');
            setErrorMsg('Face detection failed. Please ensure good lighting and try again.');
            return null;
        }
    }, [stopCamera]);

    const reset = useCallback(() => {
        stopCamera();
        setStatus('idle');
        setFaceDescriptor(null);
        setCapturedImage(null);
        setErrorMsg('');
    }, [stopCamera]);

    return {
        videoRef,
        canvasRef,
        status,
        faceDescriptor,
        capturedImage,
        errorMsg,
        startCamera,
        stopCamera,
        captureAndDetect,
        reset,
    };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function euclideanDistance(desc1: number[], desc2: number[]): number {
    if (desc1.length !== desc2.length) return Infinity;
    let sum = 0;
    for (let i = 0; i < desc1.length; i++) {
        sum += (desc1[i] - desc2[i]) ** 2;
    }
    return Math.sqrt(sum);
}

// @vladmandic/human 512-dim embeddings: threshold is tighter than face-api.js
// Typical match: ~0.3–0.4, non-match: >0.5
export const FACE_MATCH_THRESHOLD = 0.4;
