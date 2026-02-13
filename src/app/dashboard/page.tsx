'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';

interface UserProfile {
    userId: string;
    fullName: string;
    email: string;
    verified: boolean;
}

interface DashboardElection {
    id: string;
    title: string;
    description: string;
    totalVotes: number;
    candidates: { id: string; name: string; party: string; symbol: string }[];
    userVotedFor: string | null;
}

export default function DashboardPage() {
    const router = useRouter();
    const [user, setUser] = useState<UserProfile | null>(null);
    const [elections, setElections] = useState<DashboardElection[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/auth/session')
            .then((r) => r.json())
            .then((data) => {
                if (!data.authenticated) {
                    router.push('/login');
                    return;
                }
                setUser(data.user);
            });

        fetch('/api/elections')
            .then((r) => r.json())
            .then((data) => {
                setElections(data.elections || []);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [router]);

    if (loading || !user) {
        return <LoadingSpinner message="Loading dashboard..." size="lg" />;
    }

    return (
        <div className="container page-wrapper">
            <div className="page-header">
                <h1 className="page-title">👋 Welcome, {user.fullName}</h1>
                <p className="page-subtitle">Your voter dashboard</p>
            </div>

            {/* User Info Card */}
            <div className="grid-2 mb-32">
                <div className="card">
                    <h3 className="mb-16" style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>
                        Voter Profile
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Full Name</span>
                            <p style={{ fontWeight: 600 }}>{user.fullName}</p>
                        </div>
                        <div>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Email</span>
                            <p style={{ fontWeight: 600 }}>{user.email}</p>
                        </div>
                        <div>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Verification Status</span>
                            <p>
                                {user.verified ? (
                                    <span className="badge badge-success">✅ Verified</span>
                                ) : (
                                    <span className="badge badge-danger">❌ Not Verified</span>
                                )}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="card">
                    <h3 className="mb-16" style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>
                        Quick Actions
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <Link href="/vote" className="btn btn-primary w-full">
                            🗳️ Go to Voting Panel
                        </Link>
                        <Link href="/admin" className="btn btn-secondary w-full">
                            📊 View Election Results
                        </Link>
                    </div>
                </div>
            </div>

            {/* Elections Status */}
            <h2 className="mb-16" style={{ fontSize: '1.3rem', fontWeight: 700 }}>Active Elections</h2>
            {elections.length === 0 ? (
                <div className="card text-center" style={{ padding: 40 }}>
                    <p style={{ color: 'var(--text-muted)' }}>No active elections at the moment.</p>
                </div>
            ) : (
                elections.map((e) => (
                    <div key={e.id} className="card mb-16">
                        <div className="flex-between mb-16" style={{ flexWrap: 'wrap', gap: 8 }}>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{e.title}</h3>
                            {e.userVotedFor ? (
                                <span className="badge badge-success">✅ Voted</span>
                            ) : (
                                <span className="badge badge-warning">⏳ Pending</span>
                            )}
                        </div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 12 }}>
                            {e.description}
                        </p>
                        <div className="flex-gap-16" style={{ alignItems: 'center' }}>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                Total Votes: <strong style={{ color: 'var(--saffron)' }}>{e.totalVotes}</strong>
                            </span>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                Candidates: <strong>{e.candidates.length}</strong>
                            </span>
                        </div>
                        {e.userVotedFor && (
                            <div className="alert alert-success mt-12 mb-0">
                                You voted for: <strong>{e.candidates.find((c) => c.id === e.userVotedFor)?.name}</strong>
                            </div>
                        )}
                    </div>
                ))
            )}
        </div>
    );
}
