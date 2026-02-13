'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useFaceDetection } from '@/lib/face-utils';
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

const VOTE_STEPS = [
    { label: 'Choose' },
    { label: 'Verify' },
    { label: 'Confirm' },
];

export default function VotePage() {
    const router = useRouter();
    const [elections, setElections] = useState<Election[]>([]);
    const [loading, setLoading] = useState(true);
    const [voting, setVoting] = useState(false);
    const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [voteSuccess, setVoteSuccess] = useState(false);
    const [user, setUser] = useState<UserSession | null>(null);

    const [step, setStep] = useState<'select' | 'face' | 'confirm'>('select');
    const [faceVerified, setFaceVerified] = useState(false);
    const [faceVerifying, setFaceVerifying] = useState(false);
    const [verifyMessage, setVerifyMessage] = useState('');
    const [faceResult, setFaceResult] = useState<{ descriptor: number[]; image: string } | null>(null);

    const face = useFaceDetection();

    const stepIndex = step === 'select' ? 1 : step === 'face' ? 2 : 3;

    useEffect(() => {
        fetch('/api/auth/session')
            .then((r) => r.json())
            .then((data) => {
                if (!data.authenticated) { router.push('/login'); return; }
                setUser(data.user);
            });
        fetch('/api/elections')
            .then((r) => r.json())
            .then((data) => { setElections(data.elections || []); setLoading(false); })
            .catch(() => setLoading(false));
    }, [router]);

    const goToFaceStep = async () => {
        if (!selectedCandidate) return;
        setStep('face');
        setError('');
        setFaceVerified(false);
        setFaceResult(null);
        setVerifyMessage('');
        setTimeout(() => { face.startCamera(); }, 100);
    };

    const handleCapture = async () => {
        setError('');
        const result = await face.captureAndDetect();
        if (result) {
            setFaceResult({ descriptor: result.descriptor, image: result.image });
            verifyFace(result.descriptor);
        }
    };

    const verifyFace = async (descriptor: number[]) => {
        setFaceVerifying(true);
        setError('');
        setVerifyMessage('');
        try {
            const res = await fetch('/api/verify-face', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ faceDescriptor: descriptor }),
            });
            const data = await res.json();
            if (data.verified) {
                setFaceVerified(true);
                setVerifyMessage(data.message);
                setStep('confirm');
            } else {
                setError(data.message || data.error || 'Identity Mismatch!');
                setFaceVerified(false);
            }
        } catch {
            setError('Verification Error');
        } finally {
            setFaceVerifying(false);
        }
    };

    const retakePhoto = async () => {
        setFaceResult(null);
        setFaceVerified(false);
        setError('');
        setVerifyMessage('');
        face.reset();
        await face.startCamera();
    };

    const handleVote = async () => {
        if (!selectedCandidate || !elections[0] || !faceVerified || !faceResult) return;
        setVoting(true);
        setError('');
        try {
            const res = await fetch('/api/vote', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    candidateId: selectedCandidate,
                    electionId: elections[0].id,
                    faceImage: faceResult.image,
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
            setStep('face');
            setFaceResult(null);
            setFaceVerified(false);
            setVerifyMessage('');
        } else if (step === 'face') {
            setStep('select');
            setFaceResult(null);
            setFaceVerified(false);
            face.reset();
        }
        setError('');
    };

    if (loading) {
        return <LoadingSpinner message="Loading Ballots..." size="lg" />;
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
                <h1 className="page-title vote-header-title">CAST YOUR VOTE</h1>
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
                <div className="card animate-in text-center" style={{ padding: 40, background: '#f0f0f0' }}>
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
                    <div className="text-center mt-32">
                        <button className="btn btn-primary btn-lg vote-next-btn" disabled={!selectedCandidate} onClick={goToFaceStep}>
                            Next Step →
                        </button>
                    </div>
                </>
            )}

            {/* Step 2: Face Verification */}
            {step === 'face' && (
                <div style={{ maxWidth: 520, margin: '0 auto' }} className="animate-in">
                    <div className="card face-verify-card">
                        <h2 className="text-center mb-16">Verify Identity</h2>
                        <p className="text-center mb-24">We need to confirm it&apos;s really you.</p>

                        {!faceResult && (
                            <div className="webcam-container" style={{ display: (face.status === 'idle' || face.status === 'loading') ? 'none' : 'block' }}>
                                <video ref={face.videoRef} autoPlay playsInline muted />
                                <canvas ref={face.canvasRef} style={{ display: 'none' }} />
                            </div>
                        )}

                        {(face.status === 'idle' || face.status === 'loading') && !faceResult && (
                            <div className="face-loading-placeholder">
                                <div className="spinner mb-24" aria-hidden="true" />
                                <h3>Starting Camera...</h3>
                            </div>
                        )}

                        {(face.status === 'ready' || face.status === 'no-face') && !faceResult && (
                            <>
                                {face.status === 'no-face' && (
                                    <div className="alert alert-error mt-20" role="alert">No face detected!</div>
                                )}
                                <div className="text-center mt-24 flex-gap-16" style={{ justifyContent: 'center' }}>
                                    <button className="btn btn-secondary" onClick={goBack}>Cancel</button>
                                    <button className="btn btn-primary btn-lg" onClick={handleCapture}>Scan Face 📸</button>
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
                                {faceVerifying && (
                                    <div className="text-center mt-24" role="status" aria-live="polite">
                                        <div className="spinner" style={{ width: 30, height: 30, marginBottom: 10 }} aria-hidden="true" />
                                        <p><strong>Checking Biometrics...</strong></p>
                                    </div>
                                )}
                                {!faceVerifying && !faceVerified && (
                                    <div className="text-center mt-24 flex-gap-16" style={{ justifyContent: 'center' }}>
                                        <button className="btn btn-secondary" onClick={goBack}>Cancel</button>
                                        <button className="btn btn-primary" onClick={retakePhoto}>Try Again</button>
                                    </div>
                                )}
                            </>
                        )}

                        {face.status === 'error' && (
                            <div className="text-center" style={{ padding: 20 }}>
                                <div className="alert alert-error" role="alert">{face.errorMsg}</div>
                                <button className="btn btn-primary mt-12" onClick={() => face.startCamera()}>Restart Camera</button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Step 3: Confirm */}
            {step === 'confirm' && faceVerified && (
                <div style={{ maxWidth: 520, margin: '0 auto' }} className="animate-in">
                    <div className="card confirm-card">
                        <div style={{ fontSize: '4rem', marginBottom: 20 }} aria-hidden="true">🗳️</div>
                        <div className="alert alert-success mb-24" style={{ background: '#dff9fb' }}>
                            <strong>{verifyMessage}</strong>
                        </div>

                        <h2 className="mb-16">Confirm Selection</h2>
                        <div style={{ background: '#f0f0f0', padding: 20, borderRadius: 12, border: '2px solid black', marginBottom: 24 }}>
                            Vote for: <strong style={{ fontSize: '1.2rem', textTransform: 'uppercase' }}>{election?.candidates.find((c) => c.id === selectedCandidate)?.name}</strong>
                            <br />
                            <span style={{ color: '#666' }}>{election?.candidates.find((c) => c.id === selectedCandidate)?.party}</span>
                        </div>

                        <div className="flex-gap-16" style={{ justifyContent: 'center' }}>
                            <button className="btn btn-secondary" onClick={goBack}>Back</button>
                            <button className="btn btn-success btn-lg" onClick={handleVote} disabled={voting} aria-busy={voting} style={{ boxShadow: '4px 4px 0 0 black' }}>
                                {voting ? 'Encrypting...' : 'CONFIRM VOTE'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
