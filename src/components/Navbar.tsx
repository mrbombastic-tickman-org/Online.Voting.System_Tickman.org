'use client';
import Link, { type LinkProps } from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { getCSRFHeaders } from '@/lib/csrf';

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

    const handleLogout = async () => {
        await fetch('/api/auth/logout', {
            method: 'POST',
            headers: getCSRFHeaders(),
        });
        setSession({ authenticated: false });
        setMenuOpen(false);
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
                    <NavLink href="/" label="Home" active={pathname === '/'} onNavigate={() => setMenuOpen(false)} />
                    <NavLink href="/vote" label="Vote Now" active={pathname === '/vote'} onNavigate={() => setMenuOpen(false)} />
                    <NavLink href="/register" label="Register" active={pathname === '/register'} onNavigate={() => setMenuOpen(false)} />

                    {!session?.authenticated && (
                        <NavLink href="/login" label="Login" active={pathname === '/login'} onNavigate={() => setMenuOpen(false)} />
                    )}

                    {session?.authenticated && (
                        <NavLink href="/dashboard" label="Dashboard" active={pathname === '/dashboard'} onNavigate={() => setMenuOpen(false)} />
                    )}

                    {session?.authenticated && session?.user?.isAdmin && (
                        <NavLink href="/admin" label="Admin" active={pathname === '/admin'} onNavigate={() => setMenuOpen(false)} />
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

function NavLink({ href, label, active, onNavigate }: { href: LinkProps['href']; label: string; active: boolean; onNavigate?: () => void }) {
    return (
        <Link
            href={href}
            className={`nav-link ${active ? 'active' : ''}`}
            aria-current={active ? 'page' : undefined}
            onClick={onNavigate}
        >
            {label}
        </Link>
    );
}
