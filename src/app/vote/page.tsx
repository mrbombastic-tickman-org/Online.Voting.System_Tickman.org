'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useFaceDetection } from '@/lib/face-utils';
import { useFingerprint, checkBiometricAvailability } from '@/lib/fingerprint-utils';
import StepIndicator from '@/components/StepIndicator';
import LoadingSpinner from '@/components/LoadingSpinner';

interface Candidate {
    id: string;
    name: string;
    party: string;
    symbol: string;
}

interface Election {
    id: string;
    title: string;
    description: string;
    totalVotes: number;
    candidates: Candidate[];
    userVotedFor: string | null;
}

interface UserSession {
    userId: string;
    fullName: string;
    email: string;
    verified: boolean;
}

export default function VotePage() {
    const router = useRouter();
    const [elections, setElections] = useState<Election[]>([]);
    const [loading, setLoading] = useState(true);
    const [voting, setVoting] = useState(false);
    const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [voteSuccess, setVoteSuccess] = useState(false);
    const [user, setUser] = useState<UserSession | null>(null);

    // Biometric type
    const [userBiometricType, setUserBiometricType] = useState<'face' | 'fingerprint'>('face');
    const [fingerprintAvailable, setFingerprintAvailable] = useState(false);

    const [step, setStep] = useState<'select' | 'verify' | 'confirm'>('select');
    const [biometricVerified, setBiometricVerified] = useState(false);
    const [biometricVerifying, setBiometricVerifying] = useState(false);
    const [verifyMessage, setVerifyMessage] = useState('');

    // Face verification
    const [faceResult, setFaceResult] = useState<{ descriptor: number[]; image: string } | null>(null);
    const face = useFaceDetection();

    // Fingerprint verification
    const fingerprint = useFingerprint();
    const [fingerprintResult, setFingerprintResult] = useState<string | null>(null);

    const stepIndex = step === 'select' ? 1 : step === 'verify' ? 2 : 3;

    // Dynamic step label
    const VOTE_STEPS = [
        { label: 'Choose' },
        { label: userBiometricType === 'face' ? 'Face Verify' : 'Fingerprint' },
        { label: 'Confirm' },
    ];

    useEffect(() => {
        // Check session
        fetch('/api/auth/session')
            .then((r) => r.json())
            .then((data) => {
                if (!data.authenticated) { router.push('/login'); return; }
                setUser(data.user);
            });

        // Fetch elections
        fetch('/api/elections')
            .then((r) => r.json())
            .then((data) => { setElections(data.elections || []); setLoading(false); })
            .catch(() => setLoading(false));

        // Check biometric availability
        checkBiometricAvailability().then((status) => {
            setFingerprintAvailable(status.available);
        });

        // Check user's registered biometric type
        fetch('/api/verify-fingerprint')
            .then((r) => r.json())
            .then((data) => {
                if (data.biometricType) {
                    setUserBiometricType(data.biometricType);
                }
            })
            .catch(() => { });
    }, [router]);

    const goToVerifyStep = async () => {
        if (!selectedCandidate) return;
        setStep('verify');
        setError('');
        setBiometricVerified(false);
        setFaceResult(null);
        setFingerprintResult(null);
        setVerifyMessage('');

        if (userBiometricType === 'face') {
            setTimeout(() => { face.startCamera(); }, 100);
        }
    };

    // Face verification handlers
    const handleFaceCapture = async () => {
        setError('');
        const result = await face.captureAndDetect();
        if (result) {
            setFaceResult({ descriptor: result.descriptor, image: result.image });
            verifyFace(result.image);
        }
    };

    const verifyFace = async (image: string) => {
        setBiometricVerifying(true);
        setError('');
        setVerifyMessage('');
        try {
            const res = await fetch('/api/verify-face', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ faceImage: image }),
            });
            const data = await res.json();
            if (data.verified) {
                setBiometricVerified(true);
                setVerifyMessage(data.message);
                setStep('confirm');
            } else {
                setError(data.message || data.error || 'Identity Mismatch!');
                setBiometricVerified(false);
            }
        } catch {
            setError('Verification Error');
        } finally {
            setBiometricVerifying(false);
        }
    };

    // Fingerprint verification handler
    const handleFingerprintVerify = async () => {
        setBiometricVerifying(true);
        setError('');
        setVerifyMessage('');

        try {
            // Get stored credential ID from server
            const statusRes = await fetch('/api/verify-fingerprint');
            const statusData = await statusRes.json();

            if (!statusData.hasFingerprint) {
                setError('No fingerprint registered. Please use face verification.');
                setBiometricVerifying(false);
                return;
            }

            const result = await fingerprint.verify();

            if (result.success && result.assertionData) {
                // Send assertion to server for verification
                const verifyRes = await fetch('/api/verify-fingerprint', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ assertionData: result.assertionData }),
                });
                const verifyData = await verifyRes.json();

                if (verifyData.verified) {
                    setFingerprintResult(result.assertionData);
                    setBiometricVerified(true);
                    setVerifyMessage(verifyData.message || 'Fingerprint verified successfully');
                    setStep('confirm');
                } else {
                    setError(verifyData.error || 'Fingerprint verification failed');
                }
            } else {
                setError(result.error || 'Fingerprint verification failed');
            }
        } catch (err) {
            setError('Verification error occurred');
        } finally {
            setBiometricVerifying(false);
        }
    };

    const retakeBiometric = async () => {
        setFaceResult(null);
        setFingerprintResult(null);
        setBiometricVerified(false);
        setError('');
        setVerifyMessage('');

        if (userBiometricType === 'face') {
            face.reset();
            await face.startCamera();
        } else {
            fingerprint.reset();
        }
    };

    const handleVote = async () => {
        if (!selectedCandidate || !elections[0] || !biometricVerified) return;

        setVoting(true);
        setError('');
        try {
            const res = await fetch('/api/vote', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    candidateId: selectedCandidate,
                    electionId: elections[0].id,
                    // Include biometric data based on type
                    faceImage: faceResult?.image,
                    fingerprintAssertion: fingerprintResult,
                    biometricType: userBiometricType,
                }),
            });
            const data = await res.json();
            if (!res.ok) { setError(data.error); return; }
            setVoteSuccess(true);
        } catch {
            setError('Vote submission failed.');
        } finally {
            setVoting(false);
        }
    };

    const goBack = () => {
        face.stopCamera();
        if (step === 'confirm') {
            setStep('verify');
            setFaceResult(null);
            setFingerprintResult(null);
            setBiometricVerified(false);
            setVerifyMessage('');
        } else if (step === 'verify') {
            setStep('select');
            setFaceResult(null);
            setFingerprintResult(null);
            setBiometricVerified(false);
            face.reset();
            fingerprint.reset();
        }
        setError('');
    };

    if (loading) {
        return <LoadingSpinner message="Loading Ballots..." size="lg" />;
    }

    if (!elections.length) {
        return (
            <div className="container page-wrapper">
                <div className="card animate-in text-center" style={{ padding: 60 }}>
                    <div style={{ fontSize: '4rem' }} aria-hidden="true">📭</div>
                    <h2 className="mt-20">No Active Elections</h2>
                    <p className="mt-12">There are no elections available at this time.</p>
                    <button onClick={() => router.push('/dashboard')} className="btn btn-primary mt-24">
                        Return to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="container page-wrapper">
                <div className="card animate-in text-center" style={{ padding: 60 }}>
                    <div style={{ fontSize: '3rem' }} aria-hidden="true">🔒</div>
                    <h2 className="mt-20">Session Expired</h2>
                    <p className="mt-12">Please login again to vote.</p>
                    <button onClick={() => router.push('/login')} className="btn btn-primary mt-24">
                        Go to Login
                    </button>
                </div>
            </div>
        );
    }

    if (voteSuccess) {
        return (
            <div className="container page-wrapper">
                <div className="card vote-success-card animate-in">
                    <div className="vote-success-icon" aria-hidden="true">✅</div>
                    <h2 className="vote-success-title">Vote Recorded!</h2>
                    <p className="vote-success-text">Your voice has been securely counted.</p>
                    <button className="btn btn-primary btn-lg" onClick={() => router.push('/dashboard')}>Return to Dashboard</button>
                </div>
            </div>
        );
    }

    const election = elections[0];
    const alreadyVoted = election?.userVotedFor;

    return (
        <div className="container page-wrapper">
            <div className="text-center mb-40">
                <h1 className="page-title vote-header-title">Cast Your Vote</h1>
                <p className="page-subtitle vote-subtitle">
                    {election ? election.title : 'No Active Elections'}
                </p>
            </div>

            {election && !alreadyVoted && (
                <StepIndicator steps={VOTE_STEPS} currentStep={stepIndex} />
            )}

            {error && (
                <div className="alert alert-error" role="alert" style={{ maxWidth: 600, margin: '0 auto 24px' }}>
                    {error}
                </div>
            )}

            {alreadyVoted && (
                <div className="card animate-in text-center" style={{ padding: 40 }}>
                    <div style={{ fontSize: '3rem' }} aria-hidden="true">🚫</div>
                    <h2>You have already voted.</h2>
                    <p>One person, one vote. Thank you for participating.</p>
                </div>
            )}

            {/* Step 1: Select Candidate */}
            {election && !alreadyVoted && step === 'select' && (
                <>
                    <p className="text-center mb-32" style={{ fontSize: '1.1rem' }}>
                        {election.description}
                    </p>
                    <div className="grid-4" role="radiogroup" aria-label="Select a candidate">
                        {election.candidates.map((c) => (
                            <div
                                key={c.id}
                                className={`card candidate-card ${selectedCandidate === c.id ? 'selected' : ''}`}
                                onClick={() => setSelectedCandidate(c.id)}
                                role="radio"
                                aria-checked={selectedCandidate === c.id}
                                tabIndex={0}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedCandidate(c.id); } }}
                            >
                                <div className="candidate-symbol" aria-hidden="true">{c.symbol}</div>
                                <div className="candidate-name">{c.name}</div>
                                <div className="candidate-party">{c.party}</div>
                                {selectedCandidate === c.id && (
                                    <div className="badge badge-success mt-12">SELECTED</div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Biometric type selector */}
                    <div className="text-center mt-24" style={{ maxWidth: 400, margin: '24px auto' }}>
                        <p style={{ marginBottom: '12px', fontWeight: 600 }}>Verify with:</p>
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                            <button
                                type="button"
                                className={`btn ${userBiometricType === 'face' ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => setUserBiometricType('face')}
                                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                            >
                                <span>👤</span> Face
                            </button>
                            <button
                                type="button"
                                className={`btn ${userBiometricType === 'fingerprint' ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => setUserBiometricType('fingerprint')}
                                disabled={!fingerprintAvailable}
                                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                                title={!fingerprintAvailable ? 'Fingerprint not available' : ''}
                            >
                                <span>👆</span> Fingerprint
                            </button>
                        </div>
                    </div>

                    <div className="text-center mt-32">
                        <button className="btn btn-primary btn-lg vote-next-btn" disabled={!selectedCandidate} onClick={goToVerifyStep}>
                            Next Step →
                        </button>
                    </div>
                </>
            )}

            {/* Step 2: Biometric Verification */}
            {step === 'verify' && (
                <div style={{ maxWidth: 520, margin: '0 auto' }} className="animate-in">
                    <div className="card face-verify-card">
                        <h2 className="text-center mb-16">
                            {userBiometricType === 'face' ? 'Face Verification' : 'Fingerprint Verification'}
                        </h2>
                        <p className="text-center mb-24">We need to confirm it's really you.</p>

                        {userBiometricType === 'face' ? (
                            <>
                                {/* Face Verification UI */}
                                {!faceResult && (
                                    <div className="webcam-container" style={{ display: (face.status === 'idle' || face.status === 'loading') ? 'none' : 'block' }}>
                                        <video ref={face.videoRef} autoPlay playsInline muted />
                                        <canvas ref={face.canvasRef} style={{ display: 'none' }} />
                                    </div>
                                )}

                                {(face.status === 'idle' || face.status === 'loading') && !faceResult && (
                                    <div className="face-loading-placeholder" role="status" aria-live="polite" aria-busy="true">
                                        <div className="spinner mb-24" aria-hidden="true" />
                                        <h3>Starting Camera...</h3>
                                        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '12px' }}>
                                            Please allow camera access when prompted
                                        </p>
                                    </div>
                                )}

                                {(face.status === 'ready' || face.status === 'no-face') && !faceResult && (
                                    <>
                                        {face.status === 'no-face' && (
                                            <div className="alert alert-error mt-20" role="alert">No face detected!</div>
                                        )}
                                        <div className="text-center mt-24 flex-gap-16" style={{ justifyContent: 'center' }}>
                                            <button className="btn btn-secondary" onClick={goBack}>Cancel</button>
                                            <button className="btn btn-primary btn-lg" onClick={handleFaceCapture}>Scan Face 📸</button>
                                        </div>
                                    </>
                                )}

                                {face.status === 'capturing' && (
                                    <div className="text-center" style={{ padding: 40 }}>
                                        <div className="spinner" aria-hidden="true" />
                                        <p>Verifying...</p>
                                    </div>
                                )}

                                {faceResult && (
                                    <>
                                        <div className="captured-preview" style={{ borderRadius: 20 }}>
                                            <img src={faceResult.image} alt="Captured face for verification" />
                                        </div>
                                        {biometricVerifying && (
                                            <div className="text-center mt-24" role="status" aria-live="polite">
                                                <div className="spinner" style={{ width: 30, height: 30, marginBottom: 10 }} aria-hidden="true" />
                                                <p><strong>Checking Biometrics...</strong></p>
                                            </div>
                                        )}
                                        {!biometricVerifying && !biometricVerified && (
                                            <div className="text-center mt-24 flex-gap-16" style={{ justifyContent: 'center' }}>
                                                <button className="btn btn-secondary" onClick={goBack}>Cancel</button>
                                                <button className="btn btn-primary" onClick={retakeBiometric}>Try Again</button>
                                            </div>
                                        )}
                                    </>
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
                            </>
                        ) : (
                            <>
                                {/* Fingerprint Verification UI */}
                                <div className="text-center" style={{ padding: '40px 20px' }}>
                                    <div style={{ fontSize: '4rem', marginBottom: '20px' }}>👆</div>

                                    {!fingerprintResult && fingerprint.status !== 'verifying' && !biometricVerifying && (
                                        <>
                                            <p style={{ marginBottom: '20px', color: 'var(--text-muted)' }}>
                                                Click the button below and place your finger on the sensor when prompted.
                                            </p>
                                            <button
                                                className="btn btn-primary btn-lg"
                                                onClick={handleFingerprintVerify}
                                            >
                                                Verify Fingerprint
                                            </button>
                                        </>
                                    )}

                                    {(fingerprint.status === 'verifying' || biometricVerifying) && (
                                        <>
                                            <div className="spinner" style={{ margin: '0 auto 20px' }} aria-hidden="true" />
                                            <p><strong>Place your finger on the sensor...</strong></p>
                                        </>
                                    )}

                                    {fingerprintResult && biometricVerified && (
                                        <div className="alert alert-success">
                                            <span aria-hidden="true">✅</span> Fingerprint Verified!
                                        </div>
                                    )}

                                    {fingerprint.status === 'error' && (
                                        <div className="alert alert-error" style={{ marginTop: '20px' }}>
                                            {fingerprint.error}
                                        </div>
                                    )}
                                </div>

                                {!fingerprintAvailable && (
                                    <div className="alert alert-error text-center">
                                        Fingerprint authentication is not available on this device.
                                    </div>
                                )}
                            </>
                        )}

                        <div className="text-center mt-24">
                            <button className="btn btn-secondary btn-sm" onClick={goBack}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Step 3: Confirm */}
            {step === 'confirm' && biometricVerified && (
                <div style={{ maxWidth: 520, margin: '0 auto' }} className="animate-in">
                    <div className="card confirm-card">
                        <div style={{ fontSize: '4rem', marginBottom: 20 }} aria-hidden="true">🗳️</div>
                        <div className="alert alert-success mb-24">
                            <strong>{verifyMessage}</strong>
                        </div>

                        <h2 className="mb-16">Confirm Selection</h2>
                        <div style={{ background: 'var(--bg-primary)', padding: 20, borderRadius: 16, border: '1px solid #EDF2F7', marginBottom: 24 }}>
                            Vote for: <strong style={{ fontSize: '1.2rem' }}>{election?.candidates.find((c) => c.id === selectedCandidate)?.name}</strong>
                            <br />
                            <span style={{ color: 'var(--text-muted)' }}>{election?.candidates.find((c) => c.id === selectedCandidate)?.party}</span>
                        </div>

                        <div className="flex-gap-16" style={{ justifyContent: 'center' }}>
                            <button className="btn btn-secondary" onClick={goBack}>Back</button>
                            <button className="btn btn-success btn-lg" onClick={handleVote} disabled={voting} aria-busy={voting}>
                                {voting ? 'Encrypting...' : 'Confirm Vote'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
