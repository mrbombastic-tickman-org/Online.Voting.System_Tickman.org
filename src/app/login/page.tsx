'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            const data = await res.json();
            if (!res.ok) { setError(data.error); return; }
            router.push('/vote');
        } catch {
            setError('Connection failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="card auth-card animate-in">
                <div className="text-center mb-24">
                    <div className="auth-icon" aria-hidden="true">👋</div>
                </div>

                <h1 className="auth-title">Welcome Back</h1>
                <p className="auth-subtitle">Enter your credentials to continue</p>

                {error && (
                    <div className="alert alert-error mb-24" role="alert">
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin}>
                    <div className="form-group">
                        <label htmlFor="login-email" className="form-label">Email Address</label>
                        <input
                            id="login-email"
                            type="email"
                            className="form-input"
                            placeholder="user@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            autoComplete="email"
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="login-password" className="form-label">Password</label>
                        <input
                            id="login-password"
                            type="password"
                            className="form-input"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            autoComplete="current-password"
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary btn-lg auth-form-btn"
                        disabled={loading}
                        aria-busy={loading}
                    >
                        {loading ? <span className="spinner" style={{ width: 22, height: 22 }} /> : 'Login'}
                    </button>
                </form>

                <p className="auth-footer">
                    No account?{' '}
                    <Link href="/register" className="auth-link">
                        Create one here
                    </Link>
                </p>

                <div className="alert alert-info" style={{ fontSize: '0.9rem' }}>
                    <strong>New user?</strong> Create an account to participate in secure voting.
                </div>
            </div>
        </div>
    );
}
