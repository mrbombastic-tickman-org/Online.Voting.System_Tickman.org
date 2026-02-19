'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useFaceDetection } from '@/lib/face-utils';
import StepIndicator from '@/components/StepIndicator';

function PasswordStrength({ password }: { password: string }) {
    const getStrength = (pwd: string): { score: number; label: string; color: string } => {
        if (!pwd) return { score: 0, label: '', color: '' };
        let score = 0;
        if (pwd.length >= 8) score++;
        if (/[A-Z]/.test(pwd)) score++;
        if (/[a-z]/.test(pwd)) score++;
        if (/[0-9]/.test(pwd)) score++;
        if (/[^A-Za-z0-9]/.test(pwd)) score++;
        
        if (score <= 2) return { score, label: 'Weak', color: '#ff4757' };
        if (score <= 4) return { score, label: 'Medium', color: '#ffa502' };
        return { score, label: 'Strong', color: '#2ed573' };
    };
    
    const strength = getStrength(password);
    if (!password) return null;
    
    return (
        <div style={{ marginTop: '8px' }}>
            <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                {[1, 2, 3, 4, 5].map((i) => (
                    <div
                        key={i}
                        style={{
                            flex: 1,
                            height: '4px',
                            backgroundColor: i <= strength.score ? strength.color : '#e0e0e0',
                            borderRadius: '2px',
                            transition: 'background-color 0.2s'
                        }}
                    />
                ))}
            </div>
            <span style={{ fontSize: '0.8rem', color: strength.color, fontWeight: 600 }}>
                {strength.label}
            </span>
        </div>
    );
}

interface GovRecord {
    fullName: string;
    dateOfBirth: string;
    address: string;
}

const REGISTER_STEPS = [
    { label: 'Verify ID' },
    { label: 'Details' },
    { label: 'Face Scan' },
    { label: 'Finish' },
];

export default function RegisterPage() {
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [docNumber, setDocNumber] = useState('');
    const [govRecord, setGovRecord] = useState<GovRecord | null>(null);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const face = useFaceDetection();
    const [faceData, setFaceData] = useState<{ descriptor: number[]; image: string } | null>(null);

    const verifyDocument = async () => {
        setError('');
        setLoading(true);
        try {
            const res = await fetch(`/api/verify-document?documentNumber=${encodeURIComponent(docNumber)}`);
            const data = await res.json();
            if (!res.ok) { setError(data.error); return; }
            setGovRecord(data.record);
            setStep(2);
        } catch {
            setError('Connection to Government DB Failed');
        } finally {
            setLoading(false);
        }
    };

    const goToFaceStep = async () => {
        setStep(3);
        setError('');
        setTimeout(() => { face.startCamera(); }, 100);
    };

    const handleCapture = async () => {
        setError('');
        const result = await face.captureAndDetect();
        if (result) {
            setFaceData({ descriptor: result.descriptor, image: result.image });
        }
    };

    const retakePhoto = async () => {
        setFaceData(null);
        face.reset();
        await face.startCamera();
    };

    const handleRegister = async () => {
        if (!faceData) { setError('Biometric data is missing!'); return; }
        setError('');
        setLoading(true);
        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email,
                    password,
                    documentNumber: docNumber,
                    faceImage: faceData.image,
                    faceDescriptor: JSON.stringify(faceData.descriptor),
                }),
            });
            const data = await res.json();
            if (!res.ok) { setError(data.error); return; }
            setSuccess('Registration Successful! Redirecting...');
            setTimeout(() => router.push('/vote'), 2000);
        } catch {
            setError('Registration Failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container page-wrapper">
            <div className="text-center mb-40">
                <h1 className="page-title">NEW VOTER</h1>
                <p className="page-subtitle" style={{ transform: 'rotate(1deg)' }}>
                    Create your secure digital ID
                </p>
            </div>

            <StepIndicator steps={REGISTER_STEPS} currentStep={step} />

            <div style={{ maxWidth: 600, margin: '0 auto' }}>
                {error && (
                    <div className="alert alert-error" role="alert">
                        <span aria-hidden="true">⚠️</span> {error}
                    </div>
                )}
                {success && (
                    <div className="alert alert-success" role="status">
                        <span aria-hidden="true">🎉</span> {success}
                    </div>
                )}

                {/* Step 1: Verify ID */}
                {step === 1 && (
                    <div className="card register-card animate-in">
                        <h2 className="mb-16">Verify Government ID</h2>
                        <p className="mb-24">Enter your Aadhaar-style document ID to proceed.</p>

                        <div className="form-group">
                            <label htmlFor="doc-number" className="form-label">Document Number</label>
                            <input
                                id="doc-number"
                                type="text"
                                className="form-input"
                                placeholder="AADHAAR-XXXX-XXXX-XXXX"
                                value={docNumber}
                                onChange={(e) => setDocNumber(e.target.value)}
                            />
                        </div>
                        <button
                            className="btn btn-primary btn-lg w-full"
                            onClick={verifyDocument}
                            disabled={!docNumber.trim() || loading}
                            aria-busy={loading}
                        >
                            {loading ? 'Verifying...' : 'Verify Identity →'}
                        </button>
                        
                        <div className="text-center mt-24">
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                                Already have an account?{' '}
                                <Link href="/login" style={{ color: 'var(--black)', fontWeight: 700, textDecoration: 'underline' }}>
                                    Login here
                                </Link>
                            </p>
                        </div>
                    </div>
                )}

                {/* Step 2: Details */}
                {step === 2 && govRecord && (
                    <div className="card register-card animate-in">
                        <div className="alert alert-success mb-24">
                            <strong>Match Found:</strong> {govRecord.fullName}
                        </div>

                        <div className="gov-record-box">
                            <p><strong>DOB:</strong> {govRecord.dateOfBirth}</p>
                            <p><strong>Address:</strong> {govRecord.address}</p>
                        </div>

                        <div className="form-group">
                            <label htmlFor="reg-email" className="form-label">Email Address</label>
                            <input id="reg-email" type="email" className="form-input" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                        </div>
                        <div className="form-group">
                            <label htmlFor="reg-password" className="form-label">Password</label>
                            <input id="reg-password" type="password" className="form-input" placeholder="Min 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
                            <PasswordStrength password={password} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="reg-confirm" className="form-label">Confirm Password</label>
                            <input id="reg-confirm" type="password" className="form-input" placeholder="Re-enter password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" />
                        </div>

                        {confirmPassword && password !== confirmPassword && (
                            <p className="form-error" role="alert">Passwords do not match!</p>
                        )}

                        <div className="flex-gap-16 mt-20">
                            <button className="btn btn-secondary" onClick={() => setStep(1)} style={{ flex: 1 }}>Back</button>
                            <button className="btn btn-primary" onClick={goToFaceStep} disabled={!email || !password || password !== confirmPassword || password.length < 6} style={{ flex: 2 }}>
                                Next: Face Scan →
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 3: Face Capture */}
                {step === 3 && (
                    <div className="card register-card animate-in">
                        <h2 className="text-center mb-16">Biometric Scan</h2>
                        <p className="text-center mb-24">Position your face in the frame.</p>

                        {!faceData && (
                            <div className="webcam-container" style={{ display: (face.status === 'idle' || face.status === 'loading') ? 'none' : 'block' }}>
                                <video ref={face.videoRef} autoPlay playsInline muted />
                                <canvas ref={face.canvasRef} style={{ display: 'none' }} />
                                <div className="face-targeting" aria-hidden="true" />
                            </div>
                        )}

                        {(face.status === 'idle' || face.status === 'loading') && (
                            <div className="face-loading-placeholder">
                                <div className="spinner mb-24" aria-hidden="true" />
                                <h3>Initializing AI...</h3>
                            </div>
                        )}

                        {(face.status === 'ready' || face.status === 'no-face') && !faceData && (
                            <>
                                {face.status === 'no-face' && (
                                    <div className="alert alert-error mt-20" role="alert">No face detected! Try again.</div>
                                )}
                                <div className="text-center mt-24">
                                    <button className="btn btn-primary btn-lg" onClick={handleCapture}>Capture Photo 📸</button>
                                </div>
                            </>
                        )}

                        {face.status === 'capturing' && (
                            <div className="text-center" style={{ padding: 40 }}>
                                <div className="spinner" aria-hidden="true" />
                                <p>Analyzing...</p>
                            </div>
                        )}

                        {faceData && (
                            <div className="text-center">
                                <div className="captured-preview" style={{ maxWidth: 300, margin: '0 auto' }}>
                                    <img src={faceData.image} alt="Captured face" />
                                </div>
                                <div className="alert alert-success mt-24 text-center">
                                    Face Data Extracted Successfully!
                                </div>
                                <div className="flex-gap-16 mt-24" style={{ justifyContent: 'center' }}>
                                    <button className="btn btn-secondary" onClick={retakePhoto}>Retake</button>
                                    <button className="btn btn-success" onClick={() => setStep(4)}>Confirm Photo →</button>
                                </div>
                            </div>
                        )}

                        {face.status === 'error' && (
                            <div className="text-center" style={{ padding: 20 }} role="alert" aria-live="assertive">
                                <div className="alert alert-error">{face.errorMsg}</div>
                                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '12px', marginBottom: '16px' }}>
                                    Make sure you have granted camera permissions in your browser settings.
                                </p>
                                <button className="btn btn-primary mt-12" onClick={() => face.startCamera()}>Restart Camera</button>
                            </div>
                        )}

                        <div className="text-center mt-24">
                            <button className="btn btn-secondary btn-sm" onClick={() => { face.reset(); setStep(2); }}>Cancel</button>
                        </div>
                    </div>
                )}

                {/* Step 4: Confirm */}
                {step === 4 && (
                    <div className="card register-card animate-in">
                        <h2 className="text-center mb-24">Confirm & Create ID</h2>

                        <div className="summary-card">
                            <h3>Summary</h3>
                            <p><strong>Name:</strong> {govRecord?.fullName}</p>
                            <p><strong>Email:</strong> {email}</p>
                            <p><strong>ID:</strong> {docNumber}</p>
                            <p><strong>Biometrics:</strong> <span className="badge badge-success">READY</span></p>
                        </div>

                        <div className="flex-gap-16">
                            <button className="btn btn-secondary" onClick={() => setStep(3)} style={{ flex: 1 }}>Back</button>
                            <button className="btn btn-success btn-lg" onClick={handleRegister} disabled={loading || !faceData} style={{ flex: 2, boxShadow: '6px 6px 0 0 #000' }} aria-busy={loading}>
                                {loading ? 'Creating ID...' : 'Create Voter ID →'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
