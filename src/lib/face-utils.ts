'use client';
import { useRef, useState, useCallback, useEffect } from 'react';

// ─── face-api.js singleton ──────────────────────────────────────────────────
// All face-api.js references are fully dynamic (no top-level import)
// to prevent Turbopack from resolving TensorFlow during SSR.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let fapi: any = null;
let faceApiLoadPromise: Promise<void> | null = null;

async function loadFaceApi(): Promise<void> {
    // GUARD: Never load during SSR
    if (typeof window === 'undefined') {
        throw new Error('Face detection is only available in the browser');
    }

    if (fapi) return;
    if (faceApiLoadPromise) return faceApiLoadPromise;

    faceApiLoadPromise = (async () => {
        // Dynamic import — only runs in the browser
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mod: any = await import('face-api.js');
        fapi = mod;

        // Load the three models we need
        const MODEL_URL = '/models';
        await Promise.all([
            fapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            fapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
            fapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);

        console.log('[face-api.js] All models loaded successfully');
    })();

    return faceApiLoadPromise;
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
            console.log('[face-api.js] Loading models…');
            await loadFaceApi();
            console.log('[face-api.js] Models ready');

            if (!navigator.mediaDevices?.getUserMedia) {
                throw new Error('Camera not supported in this browser.');
            }

            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
            });
            console.log('[face-api.js] Camera access granted');
            streamRef.current = mediaStream;

            // Give the video element a tick to render
            await new Promise(resolve => setTimeout(resolve, 100));

            if (!videoRef.current) throw new Error('Video element not found');
            videoRef.current.srcObject = mediaStream;
            await videoRef.current.play();
            console.log('[face-api.js] Video playing');

            setStatus('ready');
        } catch (err: unknown) {
            console.error('[face-api.js] Camera start error:', err);
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
        if (!videoRef.current || !canvasRef.current || !fapi) return null;
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
            console.log('[face-api.js] Running detection…');

            // Detect face with landmarks and compute descriptor
            const detection = await fapi
                .detectSingleFace(video, new fapi.TinyFaceDetectorOptions({
                    inputSize: 416,
                    scoreThreshold: 0.6, // Increased confidence required
                }))
                .withFaceLandmarks(true) // useTinyModel = true
                .withFaceDescriptor();

            if (!detection) {
                setStatus('no-face');
                setErrorMsg('No face detected. Make sure your face is clearly visible and well-lit.');
                setCapturedImage(null);
                return null;
            }

            stopCamera();
            const descriptor = Array.from(detection.descriptor) as number[];
            setFaceDescriptor(descriptor);
            setStatus('detected');

            console.log(`[face-api.js] Face detected — embedding length: ${descriptor.length}, score: ${detection.detection.score.toFixed(3)}`);

            return {
                descriptor,
                image: dataUrl,
                score: detection.detection.score,
            };
        } catch (err) {
            console.error('[face-api.js] Detection error:', err);
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

// face-api.js 128-dim embeddings:
// Same person: ~0.3–0.4, Different person: >0.6
export const FACE_MATCH_THRESHOLD = 0.45;
