'use client';

import { Component, ReactNode } from 'react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
}

export default class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="container page-wrapper">
                    <div className="card animate-in text-center" style={{ padding: '60px 40px', maxWidth: '600px', margin: '0 auto' }}>
                        <div style={{ fontSize: '4rem', marginBottom: '20px' }} aria-hidden="true">⚠️</div>
                        <h1 style={{ fontSize: '2rem', marginBottom: '16px' }}>Something went wrong</h1>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
                            We apologize for the inconvenience. Please try refreshing the page or contact support if the problem persists.
                        </p>
                        <button 
                            onClick={() => window.location.reload()} 
                            className="btn btn-primary"
                        >
                            Refresh Page
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
