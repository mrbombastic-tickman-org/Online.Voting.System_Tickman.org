'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';
import { getCSRFHeaders } from '@/lib/csrf';

interface CandidateResult {
    id: string;
    name: string;
    party: string;
    symbol: string;
    votes: number;
}

interface ElectionResult {
    id: string;
    title: string;
    isActive: boolean;
    totalVotes: number;
    candidates: CandidateResult[];
}

interface RecentVote {
    id: string;
    ipAddress: string;
    votedAt: string;
    candidate: string;
    party: string;
    election: string;
}

interface AdminStats {
    totalUsers: number;
    verifiedUsers: number;
    totalVotes: number;
}

interface StartCandidate {
    name: string;
    party: string;
    symbol: string;
}

const DEFAULT_START_CANDIDATES: StartCandidate[] = [
    { name: 'Rajesh Kumar', party: 'National Progress Party', symbol: '🌸' },
    { name: 'Sunita Devi', party: "People's Alliance", symbol: '🌾' },
    { name: 'Mohammed Faiz', party: 'Democratic Front', symbol: '⭐' },
    { name: 'Lakshmi Narayanan', party: 'Unity Coalition', symbol: '🕊️' },
];

export default function AdminPage() {
    const router = useRouter();
    const [stats, setStats] = useState<AdminStats | null>(null);
    const [elections, setElections] = useState<ElectionResult[]>([]);
    const [recentVotes, setRecentVotes] = useState<RecentVote[]>([]);
    const [loading, setLoading] = useState(true);
    const [accessError, setAccessError] = useState('');
    const [ipTracking, setIpTracking] = useState(true);
    const [ipToggleLoading, setIpToggleLoading] = useState(false);
    const [startLoading, setStartLoading] = useState(false);
    const [startError, setStartError] = useState('');
    const [startSuccess, setStartSuccess] = useState('');
    const [electionTitle, setElectionTitle] = useState('');
    const [electionDescription, setElectionDescription] = useState('');
    const [startDateTime, setStartDateTime] = useState('');
    const [endDateTime, setEndDateTime] = useState('');
    const [candidateText, setCandidateText] = useState(
        DEFAULT_START_CANDIDATES.map((c) => `${c.name}|${c.party}|${c.symbol}`).join('\n')
    );

    useEffect(() => {
        fetch('/api/auth/session')
            .then((r) => r.json())
            .then((data) => {
                if (!data.authenticated) {
                    router.push('/login');
                    return;
                }
            });

        fetch('/api/admin/stats')
            .then((r) => {
                if (r.status === 403 || r.status === 401) {
                    setAccessError('You do not have admin privileges.');
                    setLoading(false);
                    return null;
                }
                return r.json();
            })
            .then((data) => {
                if (!data) return;
                setStats(data.stats);
                setElections(data.elections || []);
                setRecentVotes(data.recentVotes || []);
                setLoading(false);
            })
            .catch(() => setLoading(false));

        // Fetch IP tracking status
        fetch('/api/admin/ip-tracking')
            .then(r => r.json())
            .then(data => {
                if (data.ipTrackingEnabled !== undefined) {
                    setIpTracking(data.ipTrackingEnabled);
                }
            })
            .catch(() => { });
    }, [router]);

    const toggleIpTracking = async () => {
        setIpToggleLoading(true);
        try {
            const res = await fetch('/api/admin/ip-tracking', {
                method: 'POST',
                headers: getCSRFHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ enabled: !ipTracking }),
            });
            const data = await res.json();
            if (res.ok) {
                setIpTracking(data.ipTrackingEnabled);
            }
        } catch { /* ignore */ }
        setIpToggleLoading(false);
    };

    const parseCandidates = (): StartCandidate[] => {
        const lines = candidateText
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean);

        return lines
            .map((line) => {
                const [name = '', party = '', symbol = '🏛️'] = line.split('|').map((part) => part.trim());
                return { name, party, symbol: symbol || '🏛️' };
            })
            .filter((candidate) => candidate.name && candidate.party);
    };

    const startElection = async () => {
        setStartError('');
        setStartSuccess('');
        setStartLoading(true);

        try {
            const candidates = parseCandidates();
            if (candidates.length < 2) {
                setStartError('Please provide at least 2 valid candidates in format Name|Party|Symbol');
                setStartLoading(false);
                return;
            }

            const res = await fetch('/api/admin/elections/start', {
                method: 'POST',
                headers: getCSRFHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({
                    title: electionTitle,
                    description: electionDescription,
                    startDate: startDateTime || undefined,
                    endDate: endDateTime || undefined,
                    candidates,
                }),
            });

            const data = await res.json();
            if (!res.ok) {
                setStartError(data.error || 'Failed to start election');
                setStartLoading(false);
                return;
            }

            setStartSuccess(`Election started: ${data.election?.title || electionTitle || 'New Election'}`);

            const statsRes = await fetch('/api/admin/stats');
            const statsData = await statsRes.json();
            if (statsRes.ok) {
                setStats(statsData.stats);
                setElections(statsData.elections || []);
                setRecentVotes(statsData.recentVotes || []);
            }
        } catch {
            setStartError('Failed to start election');
        } finally {
            setStartLoading(false);
        }
    };

    if (loading) {
        return <LoadingSpinner message="Loading admin panel..." size="lg" />;
    }

    if (accessError) {
        return (
            <div className="container page-wrapper">
                <div className="card animate-in text-center" style={{ padding: 40 }}>
                    <div style={{ fontSize: '3rem' }} aria-hidden="true">🔒</div>
                    <h2 className="mt-20">Access Denied</h2>
                    <p className="mt-12">{accessError}</p>
                </div>
            </div>
        );
    }

    const getMaxVotes = (candidates: CandidateResult[]) =>
        Math.max(...candidates.map((c) => c.votes), 1);

    return (
        <div className="container page-wrapper">
            <div className="page-header">
                <h1 className="page-title">📊 Admin Dashboard</h1>
                <p className="page-subtitle">Election statistics and monitoring</p>
            </div>

            {/* Stats Cards */}
            <div className="stats-row" role="list" aria-label="Election statistics">
                <div className="card stat-card" role="listitem">
                    <div className="stat-number">{stats?.totalUsers || 0}</div>
                    <div className="stat-label">Registered Voters</div>
                </div>
                <div className="card stat-card" role="listitem">
                    <div className="stat-number">{stats?.verifiedUsers || 0}</div>
                    <div className="stat-label">Verified Voters</div>
                </div>
                <div className="card stat-card" role="listitem">
                    <div className="stat-number">{stats?.totalVotes || 0}</div>
                    <div className="stat-label">Total Votes Cast</div>
                </div>
            </div>

            {/* IP Tracking Toggle */}
            <div className="card mb-24" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                <div>
                    <h3 style={{ fontSize: '1rem', marginBottom: 4, fontWeight: 600 }}>🌐 IP Address Tracking</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
                        {ipTracking
                            ? 'Enforced mode: same IP or same device can vote only once per election.'
                            : 'Testing mode: IP/device duplicate-vote blocking is disabled for easier testing.'}
                    </p>
                </div>
                <button
                    className={`toggle-switch ${ipTracking ? 'active' : ''}`}
                    onClick={toggleIpTracking}
                    disabled={ipToggleLoading}
                    aria-label={`IP tracking is ${ipTracking ? 'on' : 'off'}. Click to toggle.`}
                    role="switch"
                    aria-checked={ipTracking}
                >
                    <span className="toggle-knob" />
                </button>
            </div>

            {/* Start Election */}
            <div className="card mb-24">
                <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 12 }}>Start Election</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
                    Starting a new election will deactivate currently active elections.
                </p>

                {startError && (
                    <div className="alert alert-error" role="alert">{startError}</div>
                )}
                {startSuccess && (
                    <div className="alert alert-success" role="status">{startSuccess}</div>
                )}

                <div className="form-group">
                    <label className="form-label" htmlFor="start-election-title">Election Title</label>
                    <input
                        id="start-election-title"
                        className="form-input"
                        value={electionTitle}
                        onChange={(e) => setElectionTitle(e.target.value)}
                        placeholder={`General Election ${new Date().getFullYear()}`}
                    />
                </div>

                <div className="form-group">
                    <label className="form-label" htmlFor="start-election-description">Description</label>
                    <textarea
                        id="start-election-description"
                        className="form-input"
                        value={electionDescription}
                        onChange={(e) => setElectionDescription(e.target.value)}
                        placeholder="National election started by admin."
                        rows={3}
                    />
                </div>

                <div className="grid-2 mb-16">
                    <div className="form-group">
                        <label className="form-label" htmlFor="start-election-start-date">Start Date & Time</label>
                        <input
                            id="start-election-start-date"
                            type="datetime-local"
                            className="form-input"
                            value={startDateTime}
                            onChange={(e) => setStartDateTime(e.target.value)}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label" htmlFor="start-election-end-date">End Date & Time</label>
                        <input
                            id="start-election-end-date"
                            type="datetime-local"
                            className="form-input"
                            value={endDateTime}
                            onChange={(e) => setEndDateTime(e.target.value)}
                        />
                    </div>
                </div>

                <div className="form-group">
                    <label className="form-label" htmlFor="start-election-candidates">
                        Candidates (one per line: Name|Party|Symbol)
                    </label>
                    <textarea
                        id="start-election-candidates"
                        className="form-input"
                        value={candidateText}
                        onChange={(e) => setCandidateText(e.target.value)}
                        rows={6}
                    />
                </div>

                <button
                    className="btn btn-primary"
                    onClick={startElection}
                    disabled={startLoading}
                    aria-busy={startLoading}
                >
                    {startLoading ? 'Starting...' : 'Start Election'}
                </button>
            </div>

            {/* Election Results */}
            {elections.map((election) => (
                <div key={election.id} className="card mb-24">
                    <div className="flex-between mb-24" style={{ flexWrap: 'wrap', gap: 12 }}>
                        <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>{election.title}</h2>
                        <div className="flex-gap-16" style={{ alignItems: 'center' }}>
                            <span className={`badge ${election.isActive ? 'badge-success' : 'badge-danger'}`}>
                                {election.isActive ? '🟢 Active' : '🔴 Ended'}
                            </span>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                {election.totalVotes} total votes
                            </span>
                        </div>
                    </div>

                    <div className="grid-4">
                        {election.candidates.map((c) => {
                            const maxVotes = getMaxVotes(election.candidates);
                            const percentage = election.totalVotes > 0
                                ? Math.round((c.votes / election.totalVotes) * 100)
                                : 0;
                            const isLeading = c.votes === maxVotes && c.votes > 0;

                            return (
                                <div key={c.id} className={`card candidate-card ${isLeading ? 'selected' : ''}`}
                                    style={{ cursor: 'default' }}>
                                    <div className="candidate-symbol">{c.symbol}</div>
                                    <div className="candidate-name">{c.name}</div>
                                    <div className="candidate-party">{c.party}</div>
                                    <div className="candidate-votes">{c.votes}</div>
                                    <div className="candidate-votes-label">votes ({percentage}%)</div>
                                    <div className="progress-bar mt-12" role="progressbar" aria-valuenow={percentage} aria-valuemin={0} aria-valuemax={100} aria-label={`${c.name}: ${percentage}% of votes`}>
                                        <div
                                            className={`progress-fill ${isLeading ? 'green' : ''}`}
                                            style={{ width: `${maxVotes > 0 ? (c.votes / maxVotes) * 100 : 0}%` }}
                                        />
                                    </div>
                                    {isLeading && (
                                        <div className="badge badge-success mt-12">🏆 Leading</div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}

            {/* Recent Votes */}
            <h2 className="mt-32 mb-16" style={{ fontSize: '1.2rem', fontWeight: 700 }}>
                Recent Votes (Anonymized)
            </h2>
            <div className="card" style={{ padding: 0 }}>
                <div className="table-wrapper">
                    <table aria-label="Recent votes">
                        <thead>
                            <tr>
                                <th scope="col">Time</th>
                                <th scope="col">IP Address</th>
                                <th scope="col">Candidate</th>
                                <th scope="col">Party</th>
                                <th scope="col">Election</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentVotes.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="text-center" style={{ padding: 40, color: 'var(--text-muted)' }}>
                                        No votes recorded yet
                                    </td>
                                </tr>
                            ) : (
                                recentVotes.map((v) => (
                                    <tr key={v.id}>
                                        <td>{new Date(v.votedAt).toLocaleString()}</td>
                                        <td><code>{v.ipAddress}</code></td>
                                        <td>{v.candidate}</td>
                                        <td>{v.party}</td>
                                        <td>{v.election}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
