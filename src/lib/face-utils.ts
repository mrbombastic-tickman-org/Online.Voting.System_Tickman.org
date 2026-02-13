'use client';
import { useRef, useState, useCallback, useEffect } from 'react';
import * as faceapi from 'face-api.js';

let modelsLoaded = false;
let modelsLoadPromise: Promise<void> | null = null;

async function loadModels() {
    if (modelsLoaded) return;
    if (modelsLoadPromise) {
        await modelsLoadPromise;
        return;
    }
    modelsLoadPromise = (async () => {
        const MODEL_URL = '/models';
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        modelsLoaded = true;
    })();
    await modelsLoadPromise;
}

export function useFaceDetection() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'capturing' | 'detected' | 'no-face' | 'error'>('idle');
    const [faceDescriptor, setFaceDescriptor] = useState<Float32Array | null>(null);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState('');

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(t => t.stop());
                streamRef.current = null;
            }
        };
    }, []);

    const startCamera = useCallback(async () => {
        // Stop any existing stream first
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }

        setStatus('loading');
        setErrorMsg('');

        try {
            console.log('Starting camera initialization...');
            await loadModels();
            console.log('Models loaded successfully');

            console.log('Requesting camera access...');
            // Polyfill: attach legacy getUserMedia to mediaDevices if missing
            if (!navigator.mediaDevices) {
                (navigator as any).mediaDevices = {};
            }
            if (!navigator.mediaDevices.getUserMedia) {
                navigator.mediaDevices.getUserMedia = (constraints: MediaStreamConstraints) => {
                    const legacyGetUserMedia =
                        (navigator as any).webkitGetUserMedia ||
                        (navigator as any).mozGetUserMedia ||
                        (navigator as any).msGetUserMedia;
                    if (!legacyGetUserMedia) {
                        return Promise.reject(new Error(
                            `Camera not available. Open http://localhost:3000 in your browser instead of ${window.location.origin}`
                        ));
                    }
                    return new Promise((resolve, reject) => {
                        legacyGetUserMedia.call(navigator, constraints, resolve, reject);
                    });
                };
            }
            // Try simpler constraints first to maximize compatibility
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: true // Simple constraint to just get *any* video
            });
            console.log('Camera access granted:', mediaStream.id);

            streamRef.current = mediaStream;

            // Wait a tick to ensure the video element is rendered
            await new Promise(resolve => setTimeout(resolve, 100));

            if (videoRef.current) {
                console.log('Attaching stream to video element');
                videoRef.current.srcObject = mediaStream;
                await videoRef.current.play().catch(e => console.error('Error playing video:', e));
                console.log('Video playing');
            } else {
                console.error('Video reference is null!');
                throw new Error('Video element not found');
            }

            setStatus('ready');
        } catch (err: any) {
            console.error('Camera start error:', err);
            setStatus('error');
            // enhance error message
            let msg = 'Camera error';
            if (err?.name === 'NotAllowedError' || err?.message?.includes('Permission')) {
                msg = 'Camera permission denied. Please allow access.';
            } else if (err?.name === 'NotFoundError') {
                msg = 'No camera found on this device.';
            } else if (err?.name === 'NotReadableError') {
                msg = 'Camera is in use by another application.';
            } else {
                msg = `Camera error: ${err?.message || 'Unknown error'}`;
            }
            setErrorMsg(msg);
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
            const detection = await faceapi
                .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 }))
                .withFaceLandmarks(true)
                .withFaceDescriptor();

            if (!detection) {
                setStatus('no-face');
                setErrorMsg('No face detected. Make sure your face is clearly visible and well-lit.');
                setCapturedImage(null);
                return null;
            }

            // Stop camera after successful capture
            stopCamera();

            setFaceDescriptor(detection.descriptor);
            setStatus('detected');

            return {
                descriptor: Array.from(detection.descriptor),
                image: dataUrl,
                score: detection.detection.score,
            };
        } catch (err) {
            console.error('Face detection error:', err);
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

export function euclideanDistance(desc1: number[], desc2: number[]): number {
    if (desc1.length !== desc2.length) return Infinity;
    let sum = 0;
    for (let i = 0; i < desc1.length; i++) {
        sum += (desc1[i] - desc2[i]) ** 2;
    }
    return Math.sqrt(sum);
}

export const FACE_MATCH_THRESHOLD = 0.6;
