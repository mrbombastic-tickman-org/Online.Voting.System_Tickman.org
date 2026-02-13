'use client';

interface LoadingSpinnerProps {
    message?: string;
    size?: 'sm' | 'md' | 'lg';
}

export default function LoadingSpinner({ message = 'Loading...', size = 'md' }: LoadingSpinnerProps) {
    const sizeMap = { sm: 24, md: 40, lg: 60 };
    const px = sizeMap[size];

    return (
        <div className="loading-center" role="status" aria-live="polite">
            <div
                className="spinner"
                style={{ width: px, height: px }}
                aria-hidden="true"
            />
            <p>{message}</p>
        </div>
    );
}
