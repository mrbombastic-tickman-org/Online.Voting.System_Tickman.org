'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

interface NavSession {
    authenticated: boolean;
    user?: { fullName: string; email: string; isAdmin?: boolean };
}

export default function Navbar() {
    const pathname = usePathname();
    const router = useRouter();
    const [menuOpen, setMenuOpen] = useState(false);
    const [session, setSession] = useState<NavSession | null>(null);

    useEffect(() => {
        fetch('/api/auth/session')
            .then((r) => r.json())
            .then((data) => setSession(data))
            .catch(() => setSession({ authenticated: false }));
    }, [pathname]);

    useEffect(() => {
        setMenuOpen(false);
    }, [pathname]);

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        setSession({ authenticated: false });
        router.push('/');
    };

    return (
        <nav className="navbar" role="navigation" aria-label="Main navigation">
            <div className="navbar-container">
                <Link href="/" className="navbar-brand" aria-label="VoteSecure Home">
                    VoteSecure
                </Link>

                <button
                    className="nav-toggle"
                    onClick={() => setMenuOpen(!menuOpen)}
                    aria-label={menuOpen ? 'Close menu' : 'Open menu'}
                    aria-expanded={menuOpen}
                >
                    <span></span>
                    <span></span>
                    <span></span>
                </button>

                {menuOpen && (
                    <div
                        className="nav-overlay open"
                        onClick={() => setMenuOpen(false)}
                        aria-hidden="true"
                    />
                )}

                <div className={`nav-links ${menuOpen ? 'open' : ''}`}>
                    <NavLink href="/" label="Home" active={pathname === '/'} />
                    <NavLink href="/vote" label="Vote Now" active={pathname === '/vote'} />
                    <NavLink href="/register" label="Register" active={pathname === '/register'} />

                    {!session?.authenticated && (
                        <NavLink href="/login" label="Login" active={pathname === '/login'} />
                    )}

                    {session?.authenticated && (
                        <NavLink href="/dashboard" label="Dashboard" active={pathname === '/dashboard'} />
                    )}

                    {session?.authenticated && session?.user?.isAdmin && (
                        <NavLink href="/admin" label="Admin" active={pathname === '/admin'} />
                    )}

                    {session?.authenticated && (
                        <button
                            className="btn-logout"
                            onClick={handleLogout}
                            aria-label="Log out"
                        >
                            Logout
                        </button>
                    )}
                </div>
            </div>
        </nav>
    );
}

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
    return (
        <Link
            href={href}
            className={`nav-link ${active ? 'active' : ''}`}
            aria-current={active ? 'page' : undefined}
        >
            {label}
        </Link>
    );
}
